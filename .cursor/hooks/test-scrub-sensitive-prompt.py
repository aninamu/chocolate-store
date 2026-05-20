#!/usr/bin/env python3
"""Regression checks for scrub-sensitive-prompt.py."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any


SCRIPT = Path(__file__).with_name("scrub-sensitive-prompt.py")


def run_hook(payload: Any) -> dict[str, Any]:
    input_text = payload if isinstance(payload, str) else json.dumps(payload)
    result = subprocess.run(
        [str(SCRIPT)],
        input=input_text,
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def assert_no_raw_values(message: str, raw_values: tuple[str, ...]) -> None:
    for raw_value in raw_values:
        assert raw_value not in message


def test_clean_prompt_allowed() -> None:
    output = run_hook({"event": "UserPromptSubmit", "prompt": "Please summarize the README."})

    assert output == {"continue": True}


def test_secret_prompt_blocked_with_redacted_copy() -> None:
    api_key = "sk-proj-abcdefghijklmnopqrstuvwxyz123456"
    bearer = "abcdefghijklmnop"

    output = run_hook(
        {
            "event": "UserPromptSubmit",
            "prompt": f"Use api_key={api_key} with Authorization: Bearer {bearer}.",
        }
    )

    assert output["continue"] is False
    assert "[REDACTED]" in output["user_message"]
    assert_no_raw_values(output["user_message"], (api_key, bearer))


def test_sensitive_field_names_are_not_echoed() -> None:
    field_name = "production_database_password"
    field_value = "hunter2"

    output = run_hook(
        {
            "event": "UserPromptSubmit",
            "metadata": {field_name: field_value},
            "prompt": "No inline secret here.",
        }
    )

    assert output["continue"] is False
    assert_no_raw_values(output["user_message"], (field_name, field_value))


def test_github_fine_grained_token_blocked() -> None:
    token = "github_pat_11EXAMPLE_token_value_with_enough_length"

    output = run_hook({"event": "UserPromptSubmit", "prompt": f"Use {token}."})

    assert output["continue"] is False
    assert_no_raw_values(output["user_message"], (token,))


def test_invalid_json_blocks_submission() -> None:
    output = run_hook("{not json")

    assert output["continue"] is False
    assert "could not parse" in output["user_message"]


def main() -> int:
    test_clean_prompt_allowed()
    test_secret_prompt_blocked_with_redacted_copy()
    test_sensitive_field_names_are_not_echoed()
    test_github_fine_grained_token_blocked()
    test_invalid_json_blocks_submission()
    print("scrub-sensitive-prompt regression checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
