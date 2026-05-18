"""
DevOps Agent for ContentFlow.

Handles remote deployment via SSH to backend and frontend servers.
Reads credentials from devops/.env

Usage:
    cd contentflow
    python devops/agents/devops_agent.py deploy        # deploy both
    python devops/agents/devops_agent.py deploy-backend
    python devops/agents/devops_agent.py deploy-frontend
    python devops/agents/devops_agent.py setup-backend
    python devops/agents/devops_agent.py setup-frontend
    python devops/agents/devops_agent.py status

Model routing:
- claude-haiku-4-5-20251001: config files, systemd units, backup scripts
- claude-sonnet-4-6: VPS setup script, deploy script with rollback
"""
import os
import sys
import json
import subprocess
import anthropic
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load devops/.env
_ENV_FILE = Path(__file__).parent.parent / ".env"
if _ENV_FILE.exists():
    load_dotenv(_ENV_FILE)
else:
    print(f"[WARN] {_ENV_FILE} not found — copy devops/.env.example to devops/.env and fill in credentials")

HAIKU  = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-6"

TASK_MODEL_MAP = {
    "DO-001": SONNET,   # VPS initial setup
    "DO-002": HAIKU,    # Nginx config
    "DO-003": HAIKU,    # systemd units
    "DO-004": HAIKU,    # backup script
    "DO-005": SONNET,   # deploy with rollback
    "DO-006": HAIKU,    # restart services
    "DO-007": HAIKU,    # SSL / certbot
}

SYSTEM_PROMPT = """You are the DevOps Agent for ContentFlow.
You write shell scripts, Nginx configs, and systemd service files.
Target: Ubuntu 22.04, no Docker.
Scope: devops/ directory only.
Never write frontend or backend application code."""


# ── SSH helpers ────────────────────────────────────────────────────────────────

def _parse_ssh(ssh_str: str) -> tuple[str, str]:
    """Parse 'root@1.2.3.4' → ('root', '1.2.3.4')."""
    if "@" not in ssh_str:
        raise ValueError(f"Invalid SSH format '{ssh_str}'. Expected: user@host (e.g. root@1.2.3.4)")
    user, host = ssh_str.split("@", 1)
    return user, host


def _sshpass_cmd(host: str, user: str, password: str, remote_cmd: str) -> list[str]:
    """Build sshpass command. Falls back to plain ssh if no password (key-based)."""
    ssh_opts = [
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=15",
    ]
    if password:
        return [
            "sshpass", "-p", password,
            "ssh", *ssh_opts,
            f"{user}@{host}",
            remote_cmd,
        ]
    return ["ssh", *ssh_opts, f"{user}@{host}", remote_cmd]


def _scp_cmd(host: str, user: str, password: str, local: str, remote: str) -> list[str]:
    scp_opts = ["-o", "StrictHostKeyChecking=no"]
    if password:
        return ["sshpass", "-p", password, "scp", *scp_opts, local, f"{user}@{host}:{remote}"]
    return ["scp", *scp_opts, local, f"{user}@{host}:{remote}"]


def run_ssh(ssh_str: str, password: str, command: str, label: str = "") -> bool:
    """Run a command on remote host. Returns True on success."""
    user, host = _parse_ssh(ssh_str)
    cmd = _sshpass_cmd(host, user, password, command)
    tag = f"[{label}] " if label else ""
    print(f"{tag}$ {command}")
    result = subprocess.run(cmd, capture_output=False)
    return result.returncode == 0


def run_ssh_output(ssh_str: str, password: str, command: str) -> str:
    """Run command on remote host and return stdout."""
    user, host = _parse_ssh(ssh_str)
    cmd = _sshpass_cmd(host, user, password, command)
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout.strip()


# ── Credentials from env ───────────────────────────────────────────────────────

def get_backend_creds() -> tuple[str, str]:
    ssh  = os.environ.get("BACKEND_SSH", "")
    pwd  = os.environ.get("BACKEND_SSH_PASSWORD", "")
    if not ssh:
        raise RuntimeError("BACKEND_SSH not set in devops/.env")
    return ssh, pwd


def get_frontend_creds() -> tuple[str, str]:
    ssh  = os.environ.get("FRONTEND_SSH", "")
    pwd  = os.environ.get("FRONTEND_SSH_PASSWORD", "")
    if not ssh:
        raise RuntimeError("FRONTEND_SSH not set in devops/.env")
    return ssh, pwd


# ── Deploy actions ────────────────────────────────────────────────────────────

REPO   = os.environ.get("REPO",   "https://github.com/devAsliddin/contentflow.git")
BRANCH = os.environ.get("BRANCH", "main")
DOMAIN = os.environ.get("DOMAIN", "contentflow.uz")
EMAIL  = os.environ.get("EMAIL",  "admin@contentflow.uz")

APP_DIR = "/var/www/contentflow"


def deploy_backend():
    """Pull latest code and restart backend services on the backend server."""
    ssh, pwd = get_backend_creds()
    label = "BACKEND"
    print(f"\n{'='*60}")
    print(f"  Deploying BACKEND → {ssh}")
    print(f"{'='*60}")

    commands = [
        f"cd {APP_DIR} && git fetch origin {BRANCH} && git reset --hard origin/{BRANCH}",
        f"cd {APP_DIR} && {APP_DIR}/venv/bin/pip install -r backend/requirements.txt -q",
        f"cd {APP_DIR}/backend && {APP_DIR}/venv/bin/python -m alembic upgrade head",
        "sudo systemctl restart contentflow-backend contentflow-celery contentflow-celery-beat",
        "sleep 3 && curl -sf http://localhost:8000/api/health && echo ' ✓ backend healthy'",
    ]
    for cmd in commands:
        ok = run_ssh(ssh, pwd, cmd, label)
        if not ok:
            print(f"[{label}] ✗ FAILED: {cmd}")
            return False

    print(f"[{label}] ✓ Backend deployment complete")
    return True


def deploy_frontend():
    """Build and serve latest frontend on the frontend server."""
    ssh, pwd = get_frontend_creds()
    label = "FRONTEND"
    print(f"\n{'='*60}")
    print(f"  Deploying FRONTEND → {ssh}")
    print(f"{'='*60}")

    commands = [
        f"cd {APP_DIR} && git fetch origin {BRANCH} && git reset --hard origin/{BRANCH}",
        f"cd {APP_DIR}/frontend && npm ci --silent",
        f"cd {APP_DIR}/frontend && npm run build",
        f"rsync -a --delete {APP_DIR}/frontend/dist/ /var/www/html/contentflow/",
        "sudo systemctl reload nginx && echo ' ✓ nginx reloaded'",
    ]
    for cmd in commands:
        ok = run_ssh(ssh, pwd, cmd, label)
        if not ok:
            print(f"[{label}] ✗ FAILED: {cmd}")
            return False

    print(f"[{label}] ✓ Frontend deployment complete")
    return True


def deploy_all():
    """Deploy both backend and frontend."""
    print(f"\nContentFlow Full Deployment — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    b_ok = deploy_backend()
    f_ok = deploy_frontend()
    print(f"\n{'='*60}")
    print(f"  Backend:  {'✓ OK' if b_ok else '✗ FAILED'}")
    print(f"  Frontend: {'✓ OK' if f_ok else '✗ FAILED'}")
    print(f"{'='*60}\n")


def setup_backend():
    """Run initial VPS setup on backend server."""
    ssh, pwd = get_backend_creds()
    print(f"\n  Setting up BACKEND server → {ssh}")
    run_ssh(ssh, pwd, f"bash -s -- {DOMAIN} {EMAIL}", "BACKEND-SETUP")


def setup_frontend():
    """Run initial VPS setup on frontend server."""
    ssh, pwd = get_frontend_creds()
    print(f"\n  Setting up FRONTEND server → {ssh}")
    run_ssh(ssh, pwd, f"bash -s -- {DOMAIN} {EMAIL}", "FRONTEND-SETUP")


def show_status():
    """Check service status on both servers."""
    try:
        b_ssh, b_pwd = get_backend_creds()
        print("\n── Backend server status ─────────────────────────────")
        run_ssh(b_ssh, b_pwd,
            "systemctl is-active contentflow-backend contentflow-celery nginx 2>/dev/null || true",
            "BACKEND")
    except RuntimeError as e:
        print(f"[BACKEND] {e}")

    try:
        f_ssh, f_pwd = get_frontend_creds()
        print("\n── Frontend server status ────────────────────────────")
        run_ssh(f_ssh, f_pwd, "systemctl is-active nginx 2>/dev/null || true", "FRONTEND")
    except RuntimeError as e:
        print(f"[FRONTEND] {e}")


# ── AI task execution ─────────────────────────────────────────────────────────

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


# ── CLI entry point ───────────────────────────────────────────────────────────

COMMANDS = {
    "deploy":          deploy_all,
    "deploy-backend":  deploy_backend,
    "deploy-frontend": deploy_frontend,
    "setup-backend":   setup_backend,
    "setup-frontend":  setup_frontend,
    "status":          show_status,
}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd not in COMMANDS:
        print(f"Unknown command: {cmd}")
        print(f"Available: {', '.join(COMMANDS)}")
        sys.exit(1)
    COMMANDS[cmd]()
