---
name: pagerduty-anina-workflows
description: PagerDuty anina incident workflows for this repo — open incidents summary and create/bump incident commands. Use workspace .cursor/commands paths only.
---

# PagerDuty anina — commands in this repo

Use these **workspace** command definitions (paths relative to repository root):

| Workflow | File |
| --- | --- |
| List open incidents, post Slack summary | `.cursor/commands/get-pd-incidents.md` |
| Create or bump incident, notify Slack | `.cursor/commands/create-pd-incident.md` |

Do not substitute older copies from Cursor plugin cache directories.

For MCP token and **live** config locations (**Settings → MCP**, **`~/.cursor/mcp.json`**, workspace **`.cursor/mcp.json`**), read **`.cursor/skills/pagerduty-mcp-anina-setup/SKILL.md`** (skill id `pagerduty-mcp-anina-setup`).
