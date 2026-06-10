#!/usr/bin/env bash
# Background worker: run review-local-changes and post PR comment when findings exist.
set -euo pipefail

REPO=${1:-}
DIFF_FILE=${2:-}
BRANCH=${3:-unknown}

if [[ -z "$REPO" || -z "$DIFF_FILE" || ! -f "$DIFF_FILE" || ! -s "$DIFF_FILE" ]]; then
  exit 0
fi

AGENT=$(command -v cursor-agent 2>/dev/null || command -v agent 2>/dev/null || true)
if [[ -z "$AGENT" ]]; then
  echo "cursor-agent not found; skipping pre-commit review" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh not found; review may run but PR comments will be skipped" >&2
fi

prompt_file=$(mktemp)
trap 'rm -f "$prompt_file"' EXIT

cat >"$prompt_file" <<EOF
You are a background pre-commit review worker for the chocolate-store repository.

Follow the workflow in .cursor/skills/review-local-changes/SKILL.md exactly:

1. Launch exactly one Bugbot subagent (readonly: true, description: "Bugbot", subagent_type: "bugbot").
2. Launch exactly one Security Review subagent (readonly: true, description: "Security Review", subagent_type: "security-review").

Use this prompt shape for BOTH subagents:

Full Repository Path: $REPO
Diff: uncommitted changes

IMPORTANT: The commit may have already completed. Review ONLY the changes in this captured pre-commit patch file:
$DIFF_FILE

Do NOT fix findings. Do NOT edit files.

After both subagents finish:

- If there are NO findings from either review, exit silently.
- If ANY findings exist:
  1. Resolve the open PR for branch "$BRANCH" with: gh pr view --head "$BRANCH" --json number,url
  2. If no open PR exists, exit silently.
  3. If a PR exists, post ONE comment via gh pr comment <number> --body-file <tmpfile>.
  4. Comment body format:

## Pre-commit review findings

Triggered automatically before \`git commit\` on branch \`$BRANCH\`.

### Bugbot
<one-line status or markdown table>

### Security Review
<one-line status or markdown table>

For findings, use markdown tables with columns: Severity | Location (file:line) | Finding
Sort rows by severity (highest first).
EOF

cd "$REPO"
"$AGENT" --print --trust --force --workspace "$REPO" --output-format text "$(cat "$prompt_file")"
