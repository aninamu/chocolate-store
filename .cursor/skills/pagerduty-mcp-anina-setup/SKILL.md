---
name: pagerduty-mcp-anina-setup
description: PagerDuty MCP setup for this workspace (anina). Prefer this over bundled pagerduty-mcp-setup skills that point at plugin-cache mcp.json. Read before diagnosing PagerDuty MCP auth or token issues.
---

# PagerDuty MCP (anina) — workspace setup

## Do not read plugin cache for MCP config

Some bundled **`pagerduty-mcp-setup`** skills instruct the agent to open **`mcp.json`** in a path **relative to the skill file** (e.g. two directories above `SKILL.md` under **`.cursor/plugins/cache/...`**). That file is a **template or install artifact**, not the MCP configuration Cursor uses at runtime.

**Do not** use `Read`, repo search, or terminal paths under **`**/plugins/cache/**`** or **`**/.cursor/plugins/**`** to verify or quote PagerDuty MCP configuration.

## Where configuration actually lives

1. **Cursor UI:** **Settings → MCP** (wording may vary by Cursor version). The user enables the server and stores secrets there.
2. **User-level file (common):** `~/.cursor/mcp.json` — many setups define the PagerDuty server and the `Authorization` header here.
3. **This repo (only if present):** `.cursor/mcp.json` at the workspace root, if your team added a project override.

When telling the user what to edit, prefer **Settings → MCP** and the official guide: [PagerDuty MCP server integration guide](https://support.pagerduty.com/main/docs/pagerduty-mcp-server-integration-guide). If you reference a JSON file, use **`~/.cursor/mcp.json`** or this repo’s **`.cursor/mcp.json`** — never a path under the plugin cache.

## Token and auth failures

- If tools are missing, return **needsAuth**, or calls fail with auth errors, treat the PagerDuty MCP as misconfigured.
- Instruct the user to configure a **PagerDuty User API token** for the server (header shape `Authorization: Token <token>` per PagerDuty docs), then run **Reload Window** from the Command Palette.
- **Never** ask the user to paste the token into chat.

## Incident workflows in this repository

Operational steps for anina live under **this workspace** only:

- `.cursor/commands/get-pd-incidents.md`
- `.cursor/commands/create-pd-incident.md`

Follow those files from the **workspace root** — not copies from global or plugin caches.
