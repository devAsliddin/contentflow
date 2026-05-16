"""V2-TEST-001: AI endpoint tests (V2-AI-004, V2-AI-005)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient


def _make_mock_anthropic_response(text: str):
    """Create a mock Anthropic API response."""
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


@pytest.mark.asyncio
async def test_generate_plan_v2(async_client: AsyncClient):
    """V2-AI-004: /generate-plan returns structured weekly plan."""
    mock_json = """{
      "week_start": "Monday",
      "days": [
        {
          "day": "Monday",
          "posts": [
            {
              "platform": "instagram",
              "content_idea": "Morning motivation",
              "caption_suggestion": "Start your day strong!",
              "hashtags": ["#motivation", "#morning"],
              "best_time": "08:00",
              "media_type": "image",
              "hook": "Start your day"
            }
          ]
        }
      ],
      "hashtag_suggestions": {
        "instagram": ["#motivation", "#morning"],
        "telegram": ["#yangiliklar"]
      }
    }"""

    mock_response = _make_mock_anthropic_response(mock_json)

    with patch("app.services.ai_service.AIService") as MockAI:
        instance = MockAI.return_value
        instance.client = AsyncMock()
        instance.sonnet = "claude-sonnet-4-20250514"
        instance.client.messages.create = AsyncMock(return_value=mock_response)

        with patch("app.routers.ai_v2_ext.AIService", MockAI):
            response = await async_client.post(
                "/api/v2/ai/generate-plan",
                json={
                    "niche": "fitness",
                    "frequency": 3,
                    "tone": "motivational",
                    "platforms": ["instagram", "telegram"],
                    "language": "uz",
                },
            )

    assert response.status_code == 200
    data = response.json()
    assert "days" in data
    assert "best_times" in data
    assert "hashtag_suggestions" in data
    assert "generated_at" in data


@pytest.mark.asyncio
async def test_ab_captions(async_client: AsyncClient):
    """V2-AI-005: /ab-captions returns multiple caption variants."""
    mock_json = """{
      "variants": [
        {
          "label": "A",
          "caption": "Caption A text here",
          "hashtags": ["#tag1"],
          "hook": "Caption A",
          "rationale": "Question-led approach"
        },
        {
          "label": "B",
          "caption": "Caption B text here with story",
          "hashtags": ["#tag2"],
          "hook": "Caption B",
          "rationale": "Story-led approach"
        }
      ],
      "recommendation": "Test variant A first"
    }"""

    mock_response = _make_mock_anthropic_response(mock_json)

    with patch("app.routers.ai_v2_ext.AIService") as MockAI:
        instance = MockAI.return_value
        instance.client = AsyncMock()
        instance.haiku = "claude-haiku-4-5-20251001"
        instance.client.messages.create = AsyncMock(return_value=mock_response)

        response = await async_client.post(
            "/api/v2/ai/ab-captions",
            json={
                "topic": "fitness morning routine",
                "platform": "instagram",
                "tone": "motivational",
                "variants": 2,
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "variants" in data
    assert len(data["variants"]) == 2
    assert data["variants"][0]["label"] == "A"
    assert "recommendation" in data
    assert "char_count" in data["variants"][0]


@pytest.mark.asyncio
async def test_ab_captions_min_variants(async_client: AsyncClient):
    """V2-AI-005: minimum 2 variants must be requested."""
    mock_json = '{"variants": [{"label": "A", "caption": "A", "hashtags": [], "hook": "A", "rationale": "R"}], "recommendation": "A"}'
    mock_response = _make_mock_anthropic_response(mock_json)

    with patch("app.routers.ai_v2_ext.AIService") as MockAI:
        instance = MockAI.return_value
        instance.client = AsyncMock()
        instance.haiku = "claude-haiku-4-5-20251001"
        instance.client.messages.create = AsyncMock(return_value=mock_response)

        response = await async_client.post(
            "/api/v2/ai/ab-captions",
            json={"topic": "test", "variants": 1},
        )
    # variants=1 should fail validation
    assert response.status_code == 422
