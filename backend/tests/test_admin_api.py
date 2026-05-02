from __future__ import annotations

from starlette.testclient import TestClient


def test_admin_diagnostics_runs_command(api_client: TestClient) -> None:
    response = api_client.get(
        "/api/admin/diagnostics",
        params={"command": "printf chocolate"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["command"] == "printf chocolate"
    assert data["exit_code"] == 0
    assert data["stdout"] == "chocolate"
    assert data["stderr"] == ""
