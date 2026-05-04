# Create PagerDuty incident (anina)

Create a **triggered** incident in the PagerDuty account used by [https://anina.pagerduty.com/](https://anina.pagerduty.com/) (API access is via the configured **PagerDuty MCP**; the subdomain is where humans open the incident in the web UI). Then **notify Slack** and ensure **Anina Mu** is tagged in **both** places.

## Slack destination (fixed)

Post the follow-up message to this channel (team `T0AH1PA54ER`, channel `C0B16DGJ5SR`):

- [Open channel in Slack](https://app.slack.com/client/T0AH1PA54ER/C0B16DGJ5SR)

Use the Slack API / MCP with **channel id `C0B16DGJ5SR`** (confirm the exact parameter name from the Slack MCP tool schema, e.g. `channel`).

## Optional user input

The user may paste text after invoking this command. Treat that text as the primary source for:

- **Title** — one short line (what is wrong / what needs attention).
- **Description** — richer context (symptoms, scope, links, recent changes, reproduction).

If **no** extra text was supplied, infer a meaningful title and description from **current chat context**: the problem being debugged, failing checks, error messages, branch or PR name, repository, and any open or recently viewed files. State briefly in the description that the incident was opened from Cursor and what context you used.

If you still cannot determine a sensible scope, **ask one clarifying question** (what broke / which service) before creating the incident.

## Prerequisites (do not skip)

1. **PagerDuty MCP** must be enabled for this workspace and the integration must use a **User API token** for the **anina** account (`anina.pagerduty.com`). If the MCP is missing, misconfigured, or returns auth errors, stop and tell the user to fix MCP / token / `Reload Window`, per [PagerDuty MCP integration guide](https://support.pagerduty.com/main/docs/pagerduty-mcp-server-integration-guide).
2. **`create_incident` is a write tool.** The MCP server must be started with **`--enable-write-tools`** (or equivalent). If the tool is unavailable, say so and point the user at their MCP server args/env.
3. **Slack MCP** must be available and authorized so you can post to `C0B16DGJ5SR` and resolve members. If Slack tools are missing or return auth errors, complete the PagerDuty steps if possible, then tell the user Slack failed and what to fix.

## Tagging **Anina Mu**

- **PagerDuty:** Resolve the user **Anina Mu** (match on name via `list_users` / `get_user_data` or the appropriate read tool — read schemas first). After the incident exists, use **`add_responders`** (or the schema-equivalent write tool) so she is attached to the incident as a responder, not only mentioned in prose. Also include the plain name **Anina Mu** in the incident **body/details** (or first note) so the incident text clearly calls her out alongside API-level tagging.
- **Slack:** Resolve **Anina Mu** to her **Slack member id** (`U…`) using the Slack MCP (user lookup / search — read schemas first). Include a mention in the message using Slack’s format **`<@USERID>`** (not `@displayname` alone). If lookup fails, say so in the thread and still post the message with her name spelled out, plus next steps to fix the mention.

## Execution

1. **Read the MCP tool schemas** you will use (PagerDuty: `create_incident`, `add_responders`, and any user-listing tools; Slack: message post + user lookup) **before** calling them.
2. **Resolve the PagerDuty service**
   - If the user named a service (or gave a service ID like `P…`), use that.
   - Otherwise call **`list_services`** (or the closest read tool) and pick the service that best matches the incident. If several are plausible, prefer asking the user which service over guessing wrong.
3. **Resolve Anina Mu in PagerDuty** (user id for responders) and **in Slack** (member id for `<@…>`).
4. Call **`create_incident`** with at least the **title** and **service** required by the schema. Add **body** / **details** and **urgency** when the schema supports them and the situation warrants it (customer impact → high). The body should include **Anina Mu** by name as specified above.
5. Call **`add_responders`** (or equivalent) on the new incident so **Anina Mu** is tagged as a responder per the schema.
6. **Slack:** Post to **`C0B16DGJ5SR`** a short message that:
   - **Mentions** Anina with `<@HER_SLACK_USER_ID>`,
   - Summarizes the incident (title + one line of context),
   - Includes a **link** to the incident on anina (e.g. `https://anina.pagerduty.com/incidents/<id>` or the `html_url` from the API if provided).
7. In your reply to the user, include:
   - Incident **number**, **title**, **service**, **urgency**, and **PagerDuty URL**
   - Confirmation that **Anina Mu** was added as a **responder** (or what failed)
   - That Slack was posted to **C0B16DGJ5SR**, with a **permalink** to the message if the tool returns it

## Constraints

- Do not invent API payloads; follow the tool schemas returned by the MCPs.
- Never print or request API tokens.
