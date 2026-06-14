"""Utilities for extracting and validating JSON from LLM responses.

extract_json(text)
    Strip ```json fences, find first { or [, parse with json.loads.

complete_json_validated(task_type, system, prompt, schema)
    Call complete_for_task, extract + validate JSON against a Pydantic model.
    If validation fails: 1 correction-retry, then try next provider via fallback.
    Raises on total exhaustion.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal, Type, TypeVar

from pydantic import BaseModel, ValidationError

from app.services.ai.router import TaskType, complete_for_task, _build_chain
from app.services.ai.base import AICompletion

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def extract_json(text: str) -> Any:
    """Extract JSON from an LLM response.

    Strips ```json ... ``` fences, then finds the first { or [ and parses.
    Raises json.JSONDecodeError if no valid JSON found.
    """
    # Try to extract from a ```json fence first
    fence_match = _FENCE_RE.search(text)
    if fence_match:
        candidate = fence_match.group(1).strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass  # fall through to raw extraction

    # Find first structural character — pick whichever comes first in the text
    obj_idx = text.find('{')
    arr_idx = text.find('[')

    candidates: list[tuple[int, str, str]] = []
    if obj_idx != -1:
        candidates.append((obj_idx, '{', '}'))
    if arr_idx != -1:
        candidates.append((arr_idx, '[', ']'))

    # Try in order of appearance in text
    candidates.sort(key=lambda x: x[0])

    for idx, start_char, end_char in candidates:
        last_idx = text.rfind(end_char)
        if last_idx != -1 and last_idx >= idx:
            candidate = text[idx:last_idx + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

    raise json.JSONDecodeError("No JSON object or array found", text, 0)


_CORRECTION_PROMPT = (
    "Your previous response was not valid JSON or did not match the required schema. "
    "Please return ONLY the JSON object matching the schema — no explanation, no markdown fences, "
    "just the raw JSON."
)


async def complete_json_validated(
    task_type: TaskType,
    *,
    system: str,
    prompt: str,
    schema: Type[T],
    max_tokens: int = 2000,
    temperature: float = 0.3,
) -> T:
    """Call AI, extract JSON, validate against schema.

    Strategy per provider:
      1. Call provider → extract JSON → validate Pydantic.
      2. If validation fails: send 1 correction prompt → retry validate.
      3. If still fails: log WARNING, move to next provider in chain.
    Raises RuntimeError if all providers exhausted.
    """
    chain = _build_chain(task_type)

    if not chain:
        raise RuntimeError(
            f"No AI provider available for task_type={task_type!r}."
        )

    last_exc: Exception = RuntimeError("No providers tried")

    for i, provider in enumerate(chain):
        try:
            completion: AICompletion = await provider.complete(
                system=system,
                prompt=prompt,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            parsed = _try_parse_and_validate(completion.text, schema)
            if parsed is not None:
                return parsed

            # First attempt failed — send correction retry
            logger.debug(
                "ai.json_utils: initial validation failed for provider=%s, sending correction",
                provider.name,
            )
            correction_completion: AICompletion = await provider.complete(
                system=system,
                prompt=_CORRECTION_PROMPT,
                max_tokens=max_tokens,
                temperature=0.1,  # lower temperature for corrections
            )
            parsed = _try_parse_and_validate(correction_completion.text, schema)
            if parsed is not None:
                return parsed

            # Both attempts failed — fall through to next provider
            last_exc = ValueError(
                f"Provider {provider.name!r} returned invalid JSON after correction retry"
            )

        except Exception as exc:  # noqa: BLE001
            last_exc = exc

        if i < len(chain) - 1:
            next_provider = chain[i + 1]
            logger.warning(
                "ai.json_fallback task_type=%s failed_provider=%s next_provider=%s error=%s",
                task_type, provider.name, next_provider.name, last_exc,
            )
        else:
            logger.error(
                "ai.json_chain_exhausted task_type=%s last_provider=%s error=%s",
                task_type, provider.name, last_exc,
            )

    raise last_exc


def _try_parse_and_validate(text: str, schema: Type[T]) -> T | None:
    """Return a validated Pydantic instance or None on failure."""
    try:
        raw = extract_json(text)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.debug("ai.json_utils: JSON extraction failed: %s", exc)
        return None

    try:
        return schema.model_validate(raw)
    except ValidationError as exc:
        logger.debug("ai.json_utils: Pydantic validation failed: %s", exc)
        return None
