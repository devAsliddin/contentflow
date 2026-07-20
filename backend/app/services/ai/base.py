"""Base types for the AI abstraction layer."""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class AICompletion:
    text: str
    provider: str
    model: str
    input_tokens: int | None
    output_tokens: int | None


class AIProvider(ABC):
    name: str

    @abstractmethod
    async def complete(
        self,
        *,
        system: str,
        prompt: str,
        max_tokens: int = 2000,
        temperature: float = 0.3,
    ) -> AICompletion: ...
