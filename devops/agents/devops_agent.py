"""
DevOps Agent for ContentFlow.

Handles:
- VPS setup and configuration
- Nginx and systemd files
- Deployment scripts
- GitHub setup

Model routing:
- claude-haiku-4-5-20251001: config files, systemd units, backup scripts
- claude-sonnet-4-20250514: VPS setup script, deploy script with rollback
"""
import anthropic
from pathlib import Path
import json
from datetime import datetime, timezone

HAIKU = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-20250514"

TASK_MODEL_MAP = {
    "DO-001": SONNET,
    "DO-002": HAIKU,
    "DO-003": HAIKU,
    "DO-004": HAIKU,
    "DO-005": SONNET,
    "DO-006": HAIKU,
    "DO-007": HAIKU,
}

SYSTEM_PROMPT = """You are the DevOps Agent for ContentFlow.
You write shell scripts, Nginx configs, and systemd service files.
Target: Ubuntu 22.04, no Docker.
Scope: devops/ directory only.
Never write frontend or backend application code."""


class DevOpsAgent:
    def __init__(self):
        self.client = anthropic.Anthropic()

    def get_model_for_task(self, task_id: str) -> str:
        return TASK_MODEL_MAP.get(task_id, HAIKU)

    def execute_task(self, task_id: str, task_description: str) -> str:
        model = self.get_model_for_task(task_id)
        response = self.client.messages.create(
            model=model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Task {task_id}: {task_description}"}],
        )
        return response.content[0].text

    def report_status(self, task_id: str, status: str, files_changed: list, notes: str = ""):
        status_dir = Path("information/tasks/status")
        status_dir.mkdir(parents=True, exist_ok=True)
        (status_dir / f"{task_id}.json").write_text(json.dumps({
            "agent": "devops-agent",
            "task_id": task_id,
            "status": status,
            "files_changed": files_changed,
            "notes": notes,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }, indent=2))


if __name__ == "__main__":
    agent = DevOpsAgent()
    print("DevOps Agent initialized. Ready for task assignment.")
