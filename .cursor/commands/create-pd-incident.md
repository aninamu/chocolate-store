# Create PagerDuty incident (anina)

Create a **triggered** incident in the PagerDuty account used by [https://anina.pagerduty.com/](https://anina.pagerduty.com/) (API access is via the configured **PagerDuty MCP**; the subdomain is where humans open the incident in the web UI).

## Optional user input

The user may paste text after invoking this command. Treat that text as the primary source for:

- **Title** — one short line (what is wrong / what needs attention).
- **Description** — richer context (symptoms, scope, links, recent changes, reproduction).

If **no** extra text was supplied, infer a meaningful title and description from **current chat context**: the problem being debugged, failing checks, error messages, branch or PR name, repository, and any open or recently viewed files. State briefly in the description that the incident was opened from Cursor and what context you used.

If you still cannot determine a sensible scope, **ask one clarifying question** (what broke / which service) before creating the incident.

## Prerequisites (do not skip)

1. **PagerDuty MCP** must be enabled for this workspace and the integration must use a **User API token** for the **anina** account (`anina.pagerduty.com`). If the MCP is missing, misconfigured, or returns auth errors, stop and tell the user to fix MCP / token / `Reload Window`, per [PagerDuty MCP integration guide](https://support.pagerduty.com/main/docs/pagerduty-mcp-server-integration-guide).
2. **`create_incident` is a write tool.** The MCP server must be started with **`--enable-write-tools`** (or equivalent). If the tool is unavailable, say so and point the user at their MCP server args/env.

## Execution

1. **Read the MCP tool schema** for `create_incident` on the **pagerduty** MCP server (check the descriptor for the exact server name and parameter shape in this environment) **before** calling it.
2. **Resolve the service**
   - If the user named a service (or gave a service ID like `P…`), use that.
   - Otherwise call **`list_services`** (or the closest read tool) and pick the service that best matches the incident. If several are plausible, prefer asking the user which service over guessing wrong.
3. Call **`create_incident`** with at least the **title** and **service** required by the schema. Add **body** / **details** and **urgency** when the schema supports them and the situation warrants it (customer impact → high).
4. In your reply, include:
   - Incident **number** and **title**
   - A **direct link** on the anina subdomain when you can construct it (e.g. `https://anina.pagerduty.com/incidents/<id>` — use the id returned by the API if the tool does not return a full URL)
   - The **service** name and **urgency**

## Constraints

- Do not invent API payloads; follow the tool schema returned by the MCP.
- Never print or request API tokens.
