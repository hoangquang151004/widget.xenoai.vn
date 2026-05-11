"""Migration safety gate.

Đảm bảo `alembic current` khớp `alembic heads` sau khi `alembic upgrade head`.
Tách thành script riêng vì appleboy/ssh-action (drone-ssh) với `script_stop: true`
chèn dòng kiểm tra exit code vào giữa heredoc, gây SyntaxError khi nhúng Python
trực tiếp trong workflow YAML.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


def _alembic_bin() -> str:
    """Resolve alembic executable: ưu tiên venv local, fallback PATH."""
    candidate = Path("venv/bin/alembic")
    if candidate.exists():
        return str(candidate)
    return "alembic"


def _run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()


def main() -> int:
    alembic = _alembic_bin()
    try:
        head_out = _run([alembic, "heads"])
        current_out = _run([alembic, "current"])
    except subprocess.CalledProcessError as exc:
        print(f"alembic command failed: {exc}", file=sys.stderr)
        return 2

    head_rev = re.findall(r"[0-9a-f]{10,}", head_out)
    cur_rev = re.findall(r"[0-9a-f]{10,}", current_out)
    if not head_rev or not cur_rev:
        print(
            f"Unable to parse alembic revisions. heads={head_out!r}, current={current_out!r}",
            file=sys.stderr,
        )
        return 3
    if head_rev[0] != cur_rev[0]:
        print(
            f"Migration gate failed: current={cur_rev[0]} != head={head_rev[0]}",
            file=sys.stderr,
        )
        return 4

    print(f"Migration gate passed: {cur_rev[0]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
