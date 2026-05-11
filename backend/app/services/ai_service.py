"""Anthropic Claude API integration."""
import json
import logging
from anthropic import AsyncAnthropic

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class AIService:
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.sonnet = "claude-sonnet-4-20250514"
        self.haiku = "claude-haiku-4-5-20251001"

    async def generate_plan(self, niche: str, frequency: int, tone: str, platforms: list[str], language: str = "en") -> dict:
        """Generate a weekly content plan."""
        system_prompt = """You are an expert social media content strategist.
        Generate a detailed weekly content plan in valid JSON format only.
        No markdown, no explanation — just the JSON object."""

        user_prompt = f"""Create a weekly content plan for a {niche} blogger.
        - Posts per week: {frequency}
        - Tone: {tone}
        - Platforms: {', '.join(platforms)}
        - Language: {language}

        Return JSON in this exact structure:
        {{
          "week_start": "Monday",
          "days": [
            {{
              "day": "Monday",
              "posts": [
                {{
                  "platform": "instagram",
                  "content_idea": "...",
                  "caption_suggestion": "...",
                  "hashtags": ["tag1", "tag2"],
                  "best_time": "18:00"
                }}
              ]
            }}
          ]
        }}

        Distribute {frequency} posts across the week covering only these platforms: {', '.join(platforms)}.
        Only include days that have posts."""

        response = await self.client.messages.create(
            model=self.sonnet,
            max_tokens=4096,
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
        )

        content = response.content[0].text.strip()
        # Strip markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content)

    async def generate_caption(self, topic: str, platform: str, tone: str, language: str = "en") -> dict:
        """Generate a caption for a post."""
        platform_limits = {
            "instagram": 2200,
            "tiktok": 2200,
            "telegram": 4096,
        }
        char_limit = platform_limits.get(platform, 2200)

        system_prompt = f"""You are a social media copywriter.
        Write captions for {platform} posts.
        Keep captions under {char_limit} characters.
        Return JSON only — no explanation."""

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

        content = response.content[0].text.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content)

    async def suggest_ideas(self, recent_posts: list[dict], niche: str = "") -> dict:
        """Suggest 5 post ideas based on recent history."""
        recent_summary = "\n".join(
            [f"- {p.get('caption', '')[:100]}" for p in recent_posts[:10]]
        ) if recent_posts else "No recent posts"

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

        content = response.content[0].text.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content)

    async def generate_plan_async(self, request_data: dict) -> dict:
        """Used by Celery task."""
        return await self.generate_plan(**request_data)
