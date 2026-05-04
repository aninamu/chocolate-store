# Get open PagerDuty incidents (anina)

**Setup / MCP config:** For token and “where is mcp.json” guidance, read the workspace skill **`.cursor/skills/pagerduty-mcp-anina-setup/SKILL.md`** — do **not** follow bundled `pagerduty-mcp-setup` skills that read `mcp.json` under **`.cursor/plugins/cache`** (stale template paths).

Fetch **open** (not resolved) incidents from the PagerDuty account behind [https://anina.pagerduty.com/](https://anina.pagerduty.com/) using the **PagerDuty MCP** (`list_incidents` is a **read** tool). Produce a **concise summary** for the user in this thread, then **post the same summary** to the fixed Slack channel below.

## Slack destination (fixed)

Post the summary to this channel (workspace `E09BJQ7MU86`, channel `C0ATGAPD5HC`):

- [Open channel in Slack](https://app.slack.com/client/E09BJQ7MU86/C0ATGAPD5HC)

Use the Slack MCP with **`channel_id` `C0ATGAPD5HC`** and **`slack_send_message`** (read the tool schema before calling). Return the **message permalink** from the tool response to the user when present.

## What counts as “open”

PagerDuty **open** incidents are those with status **`triggered`** or **`acknowledged`** (exclude **`resolved`**).

Call **`list_incidents`** with a `query_model` that sets:

- **`status`:** `["triggered", "acknowledged"]`
- **`sort_by`:** prefer **`["created_at:desc"]`** (or add a second sort key if the schema allows and it improves readability). If the account supports sorting by urgency and it helps triage, you may use urgency sort **only** as permitted by the schema.
- **`limit`:** use the schema default or raise only if needed; if there are many incidents, still **summarize** so the Slack message stays clear and under **~4000 characters** (Slack text limit is **5000** — leave margin).

Re-read **`list_incidents`** schema if anything is unclear; do not invent parameter shapes.

## Summary content (chat + Slack)

For **each** open incident, include at least:

- **#** — `incident_number`
- **Title** — `title` and/or `summary` from the incident object (prefer API fields; do not rename creatively)
- **Status** — `triggered` or `acknowledged`
- **Service** — service `summary` or id from the nested `service` object
- **Created** — `created_at` (ISO is fine; optionally convert once and state the timezone you used)
- **Assignees** — from `assignments` if present (assignee `summary` or id)
- **Urgency / priority** — include if the API returns them on the incident objects (omit if not present; do not guess)
- **Link** — `https://anina.pagerduty.com/incidents/<incident_api_id>` using the incident’s **`id`** field (use `html_url` from the API instead if returned)

**Header lines** for the summary (adjust counts from the actual response):

- One line: source (**anina.pagerduty.com**), **timestamp of this report** (when you ran the fetch), and **total open count**.
- If **zero** open incidents: say so clearly (“No open incidents”) in both the chat reply and Slack; still post to Slack so the channel gets a dated heartbeat.

If there are **too many** incidents to list verbosely in Slack:

- List the **first 15–25** with full fields, then add a line: **“…and N more open incidents.”** Optionally add a single link to the PagerDuty incidents list on anina if you can form it correctly without guessing query parameters.

## Security

- Do **not** print API tokens or MCP headers.
- If an incident **title/summary** clearly contains secrets (tokens, passwords, long stack traces), **redact** those substrings to `[REDACTED]` before Slack (same spirit as the create-incident command). Do not invent incident details to replace redacted text.

## Prerequisites

1. **PagerDuty MCP** must be enabled with a valid **User API token** for the anina account. On auth/config failure, stop and point the user at the [PagerDuty MCP integration guide](https://support.pagerduty.com/main/docs/pagerduty-mcp-server-integration-guide) and **Reload Window** after fixing `mcp.json`.
2. **Slack MCP** must be able to post to **`C0ATGAPD5HC`**. If Slack fails after a successful PD fetch, still return the **PagerDuty summary** in chat and explain the Slack error.

## Execution order

1. Read MCP schemas for **`list_incidents`** and **`slack_send_message`** (and any related tools you need).
2. Call **`list_incidents`** with **`status: ["triggered", "acknowledged"]`** as above.
3. Build one **markdown-formatted** summary string suitable for Slack (**bold**, bullets, links).
4. Call **`slack_send_message`** with `channel_id` **`C0ATGAPD5HC`** and that message.
5. Reply here with the **same summary** (or a slightly expanded version if helpful), the **open incident count**, and the **Slack message permalink** if the tool returned it.

## Constraints

- Do not use workspace files, git, or terminals to **fabricate** incident content; data comes from **PagerDuty MCP** only.
- Follow tool schemas exactly; on empty or error responses, say what you got instead of assuming.
