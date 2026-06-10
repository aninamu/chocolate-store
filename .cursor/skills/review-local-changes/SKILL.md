---
name: review-local-changes
description: Run a Bugbot review and a Security Review over local uncommitted changes. Use when the user asks to review work since the last commit, local changes, or dirty working tree changes.
disable-model-invocation: true
---

# Review local changes

Use this skill when the user asks to review changes made since the last commit.

## Scope

- Review target is **only** local uncommitted changes (staged + unstaged).
- Always set `Diff: uncommitted changes` for both review runs.

## Step 1: Run Bugbot

Launch exactly one Bugbot subagent with:

- `description: "Bugbot"`
- `subagent_type: "bugbot"`
- `readonly: true`
- `run_in_background: false` unless the user explicitly asks for background

Use this exact prompt:

```text
Full Repository Path: <absolute repository path>
Diff: uncommitted changes
Custom Instructions: <only include this line when the user gave specific review instructions>
```

## Step 2: Run Security Review

Launch exactly one Security Review subagent with:

- `description: "Security Review"`
- `subagent_type: "security-review"`
- `readonly: true`
- `run_in_background: false` unless the user explicitly asks for background

Use this exact prompt:

```text
Full Repository Path: <absolute repository path>
Diff: uncommitted changes
Custom Instructions: <only include this line when the user gave specific review instructions>
```

## Retry behavior

For each review subagent:

1. If invocation is wrong (prompt shape, missing fields, wrong subagent type), correct it and retry once.
2. For any other failure, retry once with the same prompt.
3. If it fails again, stop retrying and report the blocker briefly.

## Reporting format

After both reviews finish, report in this order:

1. Bugbot result
2. Security Review result

For each:

- If no diff: one sentence saying no diff was available.
- If no findings: one-line status.
- If findings exist: compact markdown table with columns:
  - `Severity`
  - `Location (file:line)`
  - `Finding`

Do not fix findings unless the user explicitly asks.
