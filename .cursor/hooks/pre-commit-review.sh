#!/usr/bin/env bash
# beforeShellExecution hook: snapshot pre-commit diff, spawn background review, allow commit.
set -euo pipefail

input=$(cat)
command=$(echo "$input" | jq -r '.command // empty')
cwd=$(echo "$input" | jq -r '.cwd // empty')

allow() {
  echo '{"permission":"allow"}'
}

if ! echo "$command" | grep -qE 'git(\s+-C\s+\S+)?\s+commit(\s|$)'; then
  allow
  exit 0
fi

repo_root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || true)
if [[ -z "$repo_root" ]]; then
  allow
  exit 0
fi

if echo "$command" | grep -qE '\s(-a|--all)(\s|$)'; then
  diff_content=$(git -C "$repo_root" diff HEAD 2>/dev/null || true)
else
  diff_content=$(git -C "$repo_root" diff --cached 2>/dev/null || true)
fi

if [[ -z "$diff_content" ]]; then
  allow
  exit 0
fi

run_dir="$repo_root/.data/review-runs"
mkdir -p "$run_dir"
timestamp=$(date +%Y%m%dT%H%M%S)
diff_file="$run_dir/pre-commit-$timestamp.patch"

if echo "$command" | grep -qE '\s(-a|--all)(\s|$)'; then
  git -C "$repo_root" diff HEAD >"$diff_file"
else
  git -C "$repo_root" diff --cached >"$diff_file"
fi

branch=$(git -C "$repo_root" branch --show-current 2>/dev/null || echo "unknown")
hook_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
worker="$hook_dir/review-local-changes-worker.sh"

if [[ ! -x "$worker" ]]; then
  allow
  exit 0
fi

log_file="$run_dir/pre-commit-$timestamp.log"
nohup "$worker" "$repo_root" "$diff_file" "$branch" >>"$log_file" 2>&1 &
disown 2>/dev/null || true

allow
exit 0
