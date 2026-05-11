"""
Backend Agent for ContentFlow.

This agent handles all FastAPI/Python tasks:
- Database models and migrations
- API routers and services
- Platform integrations (Instagram, TikTok, Telegram)
- Celery task queue
- AI service integration

Model routing:
- claude-haiku-4-5-20251001: models, schemas, CRUD, auth, analytics, upload
- claude-sonnet-4-20250514: Celery, platform APIs, AI service, security
"""
import anthropic
from pathlib import Path

HAIKU = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-20250514"

TASK_MODEL_MAP = {
    "BE-001": SONNET,
    "BE-002": SONNET,
    "BE-003": HAIKU,
    "BE-004": HAIKU,
    "BE-005": SONNET,
    "BE-006": SONNET,
    "BE-007": SONNET,
    "BE-008": SONNET,
    "BE-009": SONNET,
    "BE-010": SONNET,
    "BE-011": HAIKU,
    "BE-012": HAIKU,
}

SYSTEM_PROMPT = """You are the Backend Agent for ContentFlow.
You write Python code using FastAPI, SQLAlchemy (async), Pydantic v2, Celery, and Redis.
Scope: backend/ directory only.
Write clean, type-annotated, async Python code.
Never write frontend or devops code."""


class BackendAgent:
    def __init__(self):
        self.client = anthropic.Anthropic()

    def get_model_for_task(self, task_id: str) -> str:
        return TASK_MODEL_MAP.get(task_id, HAIKU)

    def execute_task(self, task_id: str, task_description: str) -> str:
        model = self.get_model_for_task(task_id)
        response = self.client.messages.create(
            model=model,
            max_tokens=8096,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": f"Task {task_id}: {task_description}"}
            ],
        )
        return response.content[0].text

    def report_status(self, task_id: str, status: str, files_changed: list, notes: str = ""):
        import json
        from datetime import datetime, timezone
        status_file = Path(f"information/tasks/status/{task_id}.json")
        status_file.parent.mkdir(parents=True, exist_ok=True)
        status_file.write_text(json.dumps({
            "agent": "backend-agent",
            "task_id": task_id,
            "status": status,
            "files_changed": files_changed,
            "notes": notes,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }, indent=2))


if __name__ == "__main__":
    agent = BackendAgent()
    print("Backend Agent initialized. Ready for task assignment.")
