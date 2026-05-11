"""
Team Lead Agent for ContentFlow.

Responsibilities:
- Read v1-tasks.md at startup
- Assign tasks to Frontend, Backend, or DevOps agents
- Track progress in v1-progress.md
- Update v1-changelog.md after each task completion
- Never write application code directly

Model routing:
- claude-sonnet-4-20250514: complex decisions, architecture, code review
- claude-haiku-4-5-20251001: status updates, documentation, simple coordination
"""
import anthropic
import json
from pathlib import Path
from datetime import datetime, timezone

HAIKU = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-20250514"

TASK_ROUTING = {
    "BE": "backend-agent",
    "FE": "frontend-agent",
    "DO": "devops-agent",
}

SYSTEM_PROMPT = """You are the Team Lead Agent for ContentFlow.
Your job is to coordinate the development team, assign tasks, and track progress.
You do NOT write application code. You coordinate, plan, and report.
Use claude-sonnet-4-20250514 for complex architectural decisions.
Use claude-haiku-4-5-20251001 for status updates and simple documentation."""


class TeamLeadAgent:
    def __init__(self):
        self.client = anthropic.Anthropic()
        self.tasks_file = Path("information/tasks/v1-tasks.md")
        self.progress_file = Path("information/tasks/v1-progress.md")
        self.changelog_file = Path("information/tasks/v1-changelog.md")

    def route_task(self, task_id: str) -> str:
        prefix = task_id[:2]
        return TASK_ROUTING.get(prefix, "unknown")

    def update_progress(self, task_id: str, status: str, completed_at: str = ""):
        content = self.progress_file.read_text()
        old_row = f"| {task_id} "
        for line in content.split("\n"):
            if line.startswith(f"| {task_id} "):
                new_line = line.replace("⏳ Pending", f"{'✅ Done' if status == 'completed' else '🔄 In Progress'}")
                if completed_at:
                    new_line = new_line.replace("| — |", f"| {completed_at} |")
                content = content.replace(line, new_line)
        self.progress_file.write_text(content)

    def add_changelog_entry(self, task_id: str, description: str, changes: list[str]):
        entry = f"\n### [{task_id}] {description}\n"
        for change in changes:
            entry += f"- {change}\n"
        current = self.changelog_file.read_text()
        self.changelog_file.write_text(current + entry)

    def make_decision(self, context: str) -> str:
        response = self.client.messages.create(
            model=SONNET,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": context}],
        )
        return response.content[0].text

    def update_status(self, message: str) -> str:
        response = self.client.messages.create(
            model=HAIKU,
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": message}],
        )
        return response.content[0].text

    def read_status_files(self) -> list[dict]:
        status_dir = Path("information/tasks/status")
        if not status_dir.exists():
            return []
        statuses = []
        for f in status_dir.glob("*.json"):
            try:
                statuses.append(json.loads(f.read_text()))
            except Exception:
                pass
        return statuses


if __name__ == "__main__":
    agent = TeamLeadAgent()
    print("Team Lead Agent initialized.")
    print(f"Tasks file: {agent.tasks_file}")
    print("Reading task statuses...")
    statuses = agent.read_status_files()
    print(f"Found {len(statuses)} status files.")
