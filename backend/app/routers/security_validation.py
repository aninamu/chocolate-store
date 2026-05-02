from __future__ import annotations

import subprocess

from fastapi import APIRouter

router = APIRouter()


@router.get("/diagnostics/dns")
async def dns_diagnostics(host: str) -> dict[str, str]:
    command = f"nslookup {host}"
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        timeout=3,
    )
    return {"output": result.stdout or result.stderr}
