#!/usr/bin/env python3
"""Block prompt submissions that contain likely secrets and show a redacted copy."""

from __future__ import annotations

import json
import re
import sys
from typing import Any


REDACTION = "[REDACTED]"
REDACTED_FIELD = "[REDACTED_FIELD]"
MAX_PREVIEW_CHARS = 4000

SECRET_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "private key",
        re.compile(
            r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----.*?-----END [A-Z0-9 ]*PRIVATE KEY-----",
            re.DOTALL,
        ),
    ),
    ("anthropic key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b")),
    ("openai-style key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b")),
    ("aws access key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("github fine-grained token", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{22,255}\b")),
    ("github token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,255}\b")),
    ("slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    ("stripe key", re.compile(r"\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b")),
    ("google api key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    (
        "jwt",
        re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
    ),
    ("ssn", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
)

AUTH_HEADER_PATTERN = re.compile(
    r"\b(?P<scheme>Bearer|Basic)\s+(?P<secret>[A-Za-z0-9._~+/=-]{12,})",
    re.IGNORECASE,
)
URL_CREDENTIAL_PATTERN = re.compile(r"://[^/\s:@]+:[^/\s@]+@")
ASSIGNMENT_PATTERN = re.compile(
    r"""(?ix)
    \b(?P<key>
      password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|
      auth[_-]?token|client[_-]?secret|private[_-]?key|session[_-]?cookie|cookie
    )\b
    (?P<sep>\s*[:=]\s*)
    (?P<value>"[^"]*"|'[^']*'|[^\s,;]+)
    """
)
SENSITIVE_KEY_PATTERN = re.compile(
    r"(?i)(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key|session[_-]?cookie|cookie)"
)
PROMPT_KEYS = ("prompt", "message", "text", "content", "input")


def scrub_string(value: str) -> tuple[str, set[str]]:
    findings: set[str] = set()
    scrubbed = value

    for label, pattern in SECRET_PATTERNS:
        scrubbed, count = pattern.subn(REDACTION, scrubbed)
        if count:
            findings.add(label)

    scrubbed, count = AUTH_HEADER_PATTERN.subn(
        lambda match: f"{match.group('scheme')} {REDACTION}", scrubbed
    )
    if count:
        findings.add("authorization header")

    scrubbed, count = URL_CREDENTIAL_PATTERN.subn(f"://{REDACTION}@", scrubbed)
    if count:
        findings.add("url credentials")

    def redact_assignment(match: re.Match[str]) -> str:
        findings.add("sensitive assignment")
        value = match.group("value")
        if value.startswith('"') and value.endswith('"'):
            replacement = f'"{REDACTION}"'
        elif value.startswith("'") and value.endswith("'"):
            replacement = f"'{REDACTION}'"
        else:
            replacement = REDACTION
        return f"{match.group('key')}{match.group('sep')}{replacement}"

    scrubbed = ASSIGNMENT_PATTERN.sub(redact_assignment, scrubbed)
    return scrubbed, findings


def scrub_payload(value: Any) -> tuple[Any, set[str]]:
    if isinstance(value, str):
        return scrub_string(value)

    if isinstance(value, list):
        scrubbed_items = []
        findings: set[str] = set()
        for item in value:
            scrubbed_item, item_findings = scrub_payload(item)
            scrubbed_items.append(scrubbed_item)
            findings.update(item_findings)
        return scrubbed_items, findings

    if isinstance(value, dict):
        scrubbed_dict: dict[str, Any] = {}
        findings: set[str] = set()
        for key, item in value.items():
            if SENSITIVE_KEY_PATTERN.search(str(key)):
                scrubbed_dict[REDACTED_FIELD] = REDACTION
                findings.add("sensitive field")
                continue

            scrubbed_item, item_findings = scrub_payload(item)
            scrubbed_dict[key] = scrubbed_item
            findings.update(item_findings)
        return scrubbed_dict, findings

    return value, set()


def find_prompt_text(value: Any) -> str | None:
    if isinstance(value, dict):
        for key in PROMPT_KEYS:
            item = value.get(key)
            if isinstance(item, str):
                return item
        for item in value.values():
            prompt_text = find_prompt_text(item)
            if prompt_text is not None:
                return prompt_text
    elif isinstance(value, list):
        for item in value:
            prompt_text = find_prompt_text(item)
            if prompt_text is not None:
                return prompt_text
    return None


def preview_redacted_prompt(scrubbed_payload: Any) -> str:
    prompt_text = find_prompt_text(scrubbed_payload)
    if prompt_text is None:
        prompt_text = json.dumps(scrubbed_payload, indent=2, sort_keys=True)

    if len(prompt_text) > MAX_PREVIEW_CHARS:
        return f"{prompt_text[:MAX_PREVIEW_CHARS]}\n... [truncated]"
    return prompt_text


def emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, separators=(",", ":")))


def main() -> int:
    raw_input = sys.stdin.read()
    try:
        hook_input = json.loads(raw_input)
    except json.JSONDecodeError:
        emit(
            {
                "continue": False,
                "user_message": "Prompt submission was blocked because the secret scrubber could not parse the hook input.",
            }
        )
        return 0

    scrubbed_payload, findings = scrub_payload(hook_input)
    if scrubbed_payload == hook_input:
        emit({"continue": True})
        return 0

    preview = preview_redacted_prompt(scrubbed_payload)
    labels = ", ".join(sorted(findings)) if findings else "sensitive content"
    emit(
        {
            "continue": False,
            "user_message": (
                "Potential sensitive content was detected and the prompt was blocked before submission.\n\n"
                f"Detected: {labels}\n\n"
                "Copy and submit this redacted version if it is safe to continue:\n\n"
                f"{preview}"
            ),
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
