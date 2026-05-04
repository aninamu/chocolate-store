---
name: pagerduty-mcp-anina-setup
description: PagerDuty MCP setup for this workspace (anina). Prefer this over bundled pagerduty-mcp-setup skills that point at plugin-cache mcp.json. Read before diagnosing PagerDuty MCP auth or token issues.
---

# PagerDuty MCP (anina) — workspace setup

## Live MCP configuration (use these only)

**The live config is whatever Cursor loads for MCP servers** — not any file under the plugin install or skill cache.

1. **Cursor UI (primary):** **Settings → MCP** (or **Cursor Settings → Features → MCP** depending on version). This is where users enable **PagerDuty-anina** (or the named server), edit URLs/headers, and authenticate. Prefer telling the user to open **Settings → MCP** when something is wrong.
2. **User-level JSON on disk (typical):** **`~/.cursor/mcp.json`** — Cursor commonly persists global MCP server definitions here (including `headers.Authorization` for PagerDuty). This is a **live** file for the user’s machine; it is **not** under **`~/.cursor/plugins/cache/`**.
3. **Workspace-level JSON (optional):** **`<repository-root>/.cursor/mcp.json`** — only if your team added a project-scoped MCP override. Check whether this file exists before assuming; many workspaces have **no** project `mcp.json`.

When quoting “their” MCP JSON in chat, you may read **`~/.cursor/mcp.json`** or **this workspace’s `.cursor/mcp.json`** if it exists — never plugin cache paths below.

## Do not read plugin cache for MCP config

Some bundled **`pagerduty-mcp-setup`** skills point at **`mcp.json`** **next to the skill** under **`.cursor/plugins/cache/...`**. That is a **plugin/template artifact**, not the live MCP config Cursor runs.

**Do not** use `Read`, search, or shell against **`**/plugins/cache/**`** or **`**/.cursor/plugins/**`** to diagnose or display MCP configuration.

## Token and auth failures

- If tools are missing, return **needsAuth**, or calls fail with auth errors, treat the PagerDuty MCP as misconfigured.
- Instruct the user to configure a **PagerDuty User API token** for the server (header shape `Authorization: Token <token>` per PagerDuty docs), then run **Reload Window** from the Command Palette.
- **Never** ask the user to paste the token into chat.

## Incident workflows in this repository

Operational steps for anina live under **this workspace** only:

- `.cursor/commands/get-pd-incidents.md`
- `.cursor/commands/create-pd-incident.md`

Follow those files from the **workspace root** — not copies from global or plugin caches.
