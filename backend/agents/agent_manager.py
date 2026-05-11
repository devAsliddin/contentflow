"""
Agent Manager — coordinates all ContentFlow agents.

Reads v1-tasks.md, routes each task to the correct agent,
monitors status files, and keeps v1-progress.md up to date.
"""
import json
import time
from pathlib import Path
from datetime import datetime, timezone

from backend.agents.team_lead_agent import TeamLeadAgent


class AgentManager:
    def __init__(self):
        self.team_lead = TeamLeadAgent()
        self.agents = {
            "backend-agent": None,   # Loaded on demand
            "frontend-agent": None,
            "devops-agent": None,
        }

    def poll_status(self, interval_seconds: int = 30):
        """Poll status files and update progress tracker."""
        print(f"[AgentManager] Polling status every {interval_seconds}s...")
        while True:
            statuses = self.team_lead.read_status_files()
            for status in statuses:
                if status.get("status") == "completed":
                    self.team_lead.update_progress(
                        task_id=status["task_id"],
                        status="completed",
                        completed_at=status.get("timestamp", ""),
                    )
                    self.team_lead.add_changelog_entry(
                        task_id=status["task_id"],
                        description=f"Task completed by {status['agent']}",
                        changes=status.get("files_changed", []),
                    )
            time.sleep(interval_seconds)

    def get_pending_tasks(self) -> list[str]:
        """Parse v1-progress.md to find pending tasks."""
        progress = Path("information/tasks/v1-progress.md").read_text()
        pending = []
        for line in progress.split("\n"):
            if "⏳ Pending" in line:
                parts = [p.strip() for p in line.split("|")]
                if len(parts) > 1:
                    pending.append(parts[1])
        return pending


if __name__ == "__main__":
    manager = AgentManager()
    pending = manager.get_pending_tasks()
    print(f"Pending tasks: {pending}")
