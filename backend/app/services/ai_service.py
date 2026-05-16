"""AI service — Anthropic Claude API primary, Ollama local fallback."""
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

from app.config import get_settings as _get_settings
from app.services.ollama_client import call_ollama_chat

# Model constants per spec
SONNET_MODEL = "claude-sonnet-4-20250514"
HAIKU_MODEL = "claude-haiku-4-5-20251001"
OLLAMA_DEFAULT = "llama3.2"

# Optimal posting times per platform
OPTIMAL_TIMES: dict[str, list[str]] = {
    "instagram": ["09:00", "12:00", "18:00", "20:00"],
    "telegram":  ["08:00", "13:00", "17:00", "21:00"],
    "tiktok":    ["07:00", "12:00", "19:00", "22:00"],
    "facebook":  ["09:00", "13:00", "19:00"],
    "linkedin":  ["08:00", "12:00", "17:00"],
    "youtube":   ["15:00", "18:00", "20:00"],
    "twitter":   ["08:00", "12:00", "17:00", "21:00"],
}


# ── Anthropic client wrapper ──────────────────────────────────────────────────

class _ContentBlock:
    def __init__(self, text: str):
        self.text = text


class _AnthropicResponse:
    def __init__(self, text: str):
        self.content = [_ContentBlock(text)]


class _AnthropicMessages:
    """Calls the real Anthropic API."""

    def __init__(self, client: Any):
        self._client = client

    async def create(
        self,
        model: str | None = None,
        max_tokens: int = 4096,
        messages: list[dict] | None = None,
        system: str | None = None,
        **kwargs,
    ) -> _AnthropicResponse:
        kwargs_final: dict[str, Any] = {
            "model": model or SONNET_MODEL,
            "max_tokens": max_tokens,
            "messages": messages or [],
        }
        if system:
            kwargs_final["system"] = system

        response = await self._client.messages.create(**kwargs_final)
        text = response.content[0].text if response.content else ""
        return _AnthropicResponse(text)


class _AnthropicClientWrapper:
    def __init__(self, client: Any):
        self.messages = _AnthropicMessages(client)


# ── Ollama wrapper (unchanged for fallback) ───────────────────────────────────

class _OllamaMessages:
    def __init__(self, model: str):
        self._model = model

    async def create(
        self,
        model: str | None = None,
        max_tokens: int = 4096,
        messages: list[dict] | None = None,
        system: str | None = None,
        **kwargs,
    ) -> _AnthropicResponse:
        all_messages: list[dict] = []
        if system:
            all_messages.append({"role": "system", "content": system})
        all_messages.extend(messages or [])

        try:
            text = await call_ollama_chat(
                all_messages,
                model or self._model,
                timeout=120,
            )
        except Exception as exc:
            raise RuntimeError(str(exc)) from exc
        return _AnthropicResponse(text)


class _OllamaClientWrapper:
    def __init__(self, model: str):
        self.messages = _OllamaMessages(model)


def _build_client() -> tuple[Any, str, str]:
    """Return (client, sonnet_model, haiku_model).

    Uses Anthropic if ANTHROPIC_API_KEY is set, else falls back to Ollama.
    """
    settings = _get_settings()
    if settings.anthropic_api_key:
        try:
            import anthropic  # type: ignore
            client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            wrapper = _AnthropicClientWrapper(client)
            return wrapper, SONNET_MODEL, HAIKU_MODEL
        except ImportError:
            logger.warning(
                "anthropic package not installed — falling back to Ollama. "
                "Run: pip install anthropic"
            )

    wrapper = _OllamaClientWrapper(OLLAMA_DEFAULT)
    return wrapper, OLLAMA_DEFAULT, OLLAMA_DEFAULT


# ── Main AIService ────────────────────────────────────────────────────────────


class AIService:
    def __init__(self):
        self.client, self.sonnet, self.haiku = _build_client()

    async def generate_plan(
        self,
        niche: str,
        frequency: int,
        tone: str,
        platforms: list[str],
        language: str = "en",
        week_start: str = "Monday",
    ) -> dict:
        """Generate a weekly content plan matching the spec's WeeklyPlan shape."""
        platform_times = {p: OPTIMAL_TIMES.get(p, ["12:00"]) for p in platforms}
        times_desc = "\n".join(
            f"  - {p}: {', '.join(slots)}"
            for p, slots in platform_times.items()
        )

        system_prompt = (
            "You are an expert social media content strategist. "
            "Generate a weekly posting plan in valid JSON only. "
            "No markdown fences, no explanation — raw JSON object."
        )

        user_prompt = f"""Create a weekly content plan.
Niche: {niche}
Tone: {tone}
Posts per platform per day: {frequency}
Platforms: {', '.join(platforms)}
Language: {language}
Week start date (Monday): {week_start}

Optimal posting times:
{times_desc}

Return JSON exactly matching this structure:
{{
  "week_start": "{week_start}",
  "posts": [
    {{
      "day": 0,
      "platform": "instagram",
      "idea": "Short post idea max 7 words",
      "scheduled_time": "09:00"
    }}
  ]
}}

day field: 0=Monday, 1=Tuesday, ..., 6=Sunday.
Distribute {frequency} posts per platform across the 7 days.
Use the optimal times listed above for each platform.
Only include platforms from this list: {', '.join(platforms)}.
Each idea must be max 7 words."""

        response = await self.client.messages.create(
            model=self.sonnet,
            max_tokens=4096,
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
        )
        result = _parse_json(response.content[0].text)

        # Ensure backward-compat: if old format returned (with "days"), convert it
        if "days" in result and "posts" not in result:
            result = _convert_old_plan_to_new(result, week_start)

        return result

    async def generate_captions_batch(
        self,
        niche: str,
        tone: str,
        posts: list[dict],
    ) -> dict:
        """Batch caption generation for multiple posts in a single AI call."""
        posts_desc = "\n".join(
            f"  - day={p['day']} platform={p['platform']} idea=\"{p['idea']}\""
            for p in posts
        )

        system_prompt = (
            "You are a social media copywriter. Generate captions for multiple posts. "
            "Return valid JSON only — no markdown, no explanation."
        )

        user_prompt = f"""Generate captions for the following posts.
Niche: {niche}
Tone: {tone}

Posts:
{posts_desc}

Return JSON:
{{
  "captions": [
    {{
      "day": 0,
      "platform": "instagram",
      "idea": "exact idea text from input",
      "caption": "the full caption text",
      "hashtags": ["tag1", "tag2", "tag3"]
    }}
  ]
}}

Rules:
- idea must exactly match the input idea text
- hashtags: exactly 3 tags, no # symbol
- caption must fit platform character limits
- use the niche and tone for all captions"""

        response = await self.client.messages.create(
            model=self.sonnet,
            max_tokens=8192,
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
        )
        return _parse_json(response.content[0].text)

    async def generate_caption(
        self,
        topic: str,
        platform: str,
        tone: str,
        language: str = "en",
    ) -> dict:
        """Generate a single caption for a post."""
        platform_limits = {
            "instagram": 2200,
            "tiktok": 2200,
            "telegram": 4096,
            "facebook": 63206,
            "linkedin": 3000,
            "youtube": 5000,
            "twitter": 280,
        }
        char_limit = platform_limits.get(platform, 2200)

        system_prompt = (
            f"You are a social media copywriter. Write captions for {platform} posts. "
            f"Keep captions under {char_limit} characters. Return JSON only — no explanation."
        )
        user_prompt = f"""Write a {tone} {platform} caption about: {topic}
Language: {language}

Return JSON:
{{
  "caption": "the caption text",
  "hashtags": ["tag1", "tag2", "tag3"],
  "character_count": 150
}}"""

        response = await self.client.messages.create(
            model=self.haiku,
            max_tokens=1024,
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
        )
        result = _parse_json(response.content[0].text)

        # Ensure character_count is accurate
        if "caption" in result:
            result["character_count"] = len(result["caption"])

        return result

    async def suggest_ideas(self, recent_posts: list[dict], niche: str = "") -> dict:
        """Suggest 5 post ideas based on recent history."""
        recent_summary = (
            "\n".join([f"- {p.get('caption', '')[:100]}" for p in recent_posts[:10]])
            if recent_posts
            else "No recent posts"
        )

        system_prompt = "You are a creative social media strategist. Return JSON only."
        user_prompt = f"""Suggest 5 fresh post ideas for a {niche or 'general'} content creator.

Recent content:
{recent_summary}

Return JSON:
{{
  "ideas": [
    {{
      "title": "Post title",
      "description": "Brief description",
      "platform": "instagram",
      "content_type": "image"
    }}
  ]
}}"""

        response = await self.client.messages.create(
            model=self.haiku,
            max_tokens=1024,
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
        )
        return _parse_json(response.content[0].text)

    async def generate_plan_async(self, request_data: dict) -> dict:
        """Used by Celery task."""
        return await self.generate_plan(**request_data)


def _convert_old_plan_to_new(old_plan: dict, week_start: str) -> dict:
    """Convert old {days: [{day, posts: [...]}]} format to new {posts: []} format."""
    day_map = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6,
    }
    posts = []
    for day_entry in old_plan.get("days", []):
        day_name = day_entry.get("day", "").lower()
        day_num = day_map.get(day_name, 0)
        for p in day_entry.get("posts", []):
            posts.append({
                "day": day_num,
                "platform": p.get("platform", "instagram"),
                "idea": p.get("content_idea", p.get("caption_suggestion", ""))[:60],
                "scheduled_time": p.get("best_time", "12:00"),
            })
    return {"week_start": week_start, "posts": posts}


def _parse_json(content: str) -> dict:
    content = content.strip()
    # Strip markdown code fences if present
    if content.startswith("```"):
        parts = content.split("```")
        content = parts[1] if len(parts) > 1 else content
        if content.startswith("json"):
            content = content[4:].strip()
    return json.loads(content)
