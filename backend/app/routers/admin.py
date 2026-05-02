from __future__ import annotations

import subprocess

from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/diagnostics")
def run_diagnostic(
    command: str = Query("uptime", description="Shell command to run for diagnostics."),
) -> dict[str, int | str]:
    result = subprocess.run(
        command,
        capture_output=True,
        shell=True,
        text=True,
        timeout=5,
    )
    return {
        "command": command,
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }
