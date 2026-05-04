# Create PagerDuty incident (anina)

Create a **triggered** incident in the PagerDuty account used by [https://anina.pagerduty.com/](https://anina.pagerduty.com/) (API access is via the configured **PagerDuty MCP**; the subdomain is where humans open the incident in the web UI). Then **notify Slack** and ensure **Anina Mu** is tagged in **both** places.

**Deduplication:** If an **open** incident (**`triggered`** or **`acknowledged`**) already covers **the same issue** the user is describing, **do not** call `create_incident`. **Bump** that incident instead (`add_note_to_incident` per schema), then refresh status with `get_incident`, notify Slack, and tell the user clearly that the incident **already existed** and was bumped—not duplicated.

## Slack destination (fixed)

Post the follow-up message to this channel (workspace `E09BJQ7MU86`, channel `C0ATGAPD5HC`):

- [Open channel in Slack](https://app.slack.com/client/E09BJQ7MU86/C0ATGAPD5HC)

Use the Slack API / MCP with **channel id `C0ATGAPD5HC`** (Slack MCP parameter is typically **`channel_id`** — confirm from the tool schema).

## Optional user input

The user may paste text after invoking this command. Treat that text as the **primary** source for:

- **Title** — one short line (what is wrong / what needs attention).
- **Description** — richer context (symptoms, scope, links, recent changes, reproduction).

### What you may **not** use for incident text (minimization)

Do **not** pull incident title or body from: open or recently viewed **files**, workspace-wide search, **git** history or diffs, **terminals**, environment variables, MCP resources, or any editor or IDE state **unless** that exact text was **copied into this chat by the user** (paste or quote).

You **may** use: (1) text the user supplied with the command or in **this thread** as the incident narrative, and (2) **non-sensitive** metadata they explicitly name in chat (e.g. a **full repo URL** pasted in chat, public branch name, CI job name) **only** if they typed it here—do not read it from disk or tooling for prose.

**Exception (repository URL only):** To satisfy **Repository link (required)** below, you may read **only** `git remote get-url origin` (or one equivalent remote) and normalize it to a **public HTTPS** clone URL for a single `Repository:` line. Do **not** use git commands for any other incident text.

If there is **not** enough user-authored text in chat for a safe title and description, **stop** and ask them to paste a short title and description. Do **not** invent or infer operational details from the workspace to fill gaps.

## Repository link (required)

Every incident **body/details** must include a dedicated line with a **clickable HTTPS URL** to the code repository, not a bare name:

- Use the format **`Repository: https://…`** (markdown link in Slack is fine: `Repository: <https://…>`).

**How to resolve the URL (in order):**

1. If the user pasted a full **https://** repo URL in chat, use that (after redaction if needed).
2. Else use the **Exception** under *What you may not use*: read `git remote get-url origin`, strip credentials if present, and normalize SSH forms (e.g. `git@github.com:org/repo.git`) to **`https://github.com/org/repo`** (same idea for GitLab/Bitbucket hosts).
3. If the remote is missing, private without a safe public URL, or you cannot normalize confidently, **stop** and ask the user to paste the canonical **HTTPS** repo link before creating the incident.

Repeat the same **`Repository:`** HTTPS URL in the **Slack** message (its own bullet or line) so responders can open the repo from Slack without opening PagerDuty.

## Security: redaction (required)

**Redaction (before send):** On every string that will go to PagerDuty or Slack, remove or replace with `[REDACTED]`: API tokens and keys, passwords, private keys, cookies, `Authorization` / `Bearer` values, database connection strings, long opaque secrets (e.g. base64 blobs), webhook URLs with embedded secrets, and **full stack traces** (replace with one neutral line, e.g. “Application error during checkout,” without paths or line numbers). Truncate or generalize **internal-only URLs** hosts unless the user explicitly asked to include them. If heavy redaction would hide the incident meaning, ask the user for a **sanitized** rewrite instead of guessing.

**No confirmation gate:** After redaction and resolving service/users, either (**duplicate path**) call `create_incident`, `add_responders`, and `slack_send_message`, or (**existing incident path**) call `add_note_to_incident`, optionally `add_responders`, `get_incident`, and `slack_send_message`—without waiting for a separate user approval step, except where **ambiguous duplicate detection** explicitly requires user input (see **Execution**). You may still briefly summarize what you sent in your reply (title, service, urgency, links).

## Prerequisites (do not skip)

1. **PagerDuty MCP (live config)** must be `ready` when checked via **`GetMcpTools`** for server **`PagerDuty-anina`**. If status is `needsAuth` / `error` / `loading`, stop and tell the user to fix live MCP auth / token and `Reload Window`, per [PagerDuty MCP integration guide](https://support.pagerduty.com/main/docs/pagerduty-mcp-server-integration-guide).
2. **Write tools:** `create_incident`, `add_note_to_incident`, `add_responders`, and `manage_incidents` must appear in the live **`GetMcpTools`** output for `PagerDuty-anina`; if unavailable, point the user at their MCP server args/env (for example write-tools flags).
3. **Slack MCP (live config)** must be `ready` via **`GetMcpTools`** for server **`Slack`** so you can post to `C0ATGAPD5HC` and resolve members. If Slack tools are missing or return auth errors, complete the PagerDuty steps if possible, then tell the user Slack failed and what to fix.
4. **Do not** use cached plugin files (for example `.../plugins/cache/.../mcp.json`) as an auth source of truth; only live MCP server status/tool calls are authoritative.

## Tagging **Anina Mu**

- **PagerDuty:** Resolve the user **Anina Mu** (match on name via `list_users` / `get_user_data` or the appropriate read tool — read schemas first). For **new** incidents, use **`add_responders`** so she is attached as a responder, not only mentioned in prose. For **bumped** incidents, add **`add_responders`** when the schema supports it. Include the plain name **Anina Mu** in the incident **body/details**, or in the **bump note** for existing incidents, so the text clearly calls her out alongside API-level tagging.
- **Slack:** Resolve **Anina Mu** to her **Slack member id** (`U…`) using the Slack MCP (user lookup / search — read schemas first). Include a mention in the message using Slack’s format **`<@USERID>`** (not `@displayname` alone). If lookup fails, say so in the thread and still post the message with her name spelled out, plus next steps to fix the mention.

## Execution

1. **Validate live MCP availability first** with `GetMcpTools` for `PagerDuty-anina` and `Slack`; continue only when required servers/tools are ready.
2. **Read the MCP tool schemas** you will use (PagerDuty: `list_incidents`, `create_incident`, `get_incident`, `add_note_to_incident`, `add_responders`, and any user-listing tools; Slack: message post + user lookup) **before** calling them.
3. **Gather incident text (minimization)** — Collect **only** text allowed under **Optional user input** / **What you may not use**. Resolve and insert the **Repository** HTTPS line per **Repository link (required)**. Redact per **Security** before any outbound write.
4. **Resolve the PagerDuty service**
   - If the user named a service (or gave a service ID like `P…`), use that.
   - Otherwise call **`list_services`** (or the closest read tool) and pick the service that best matches the incident. If several are plausible, prefer asking the user which service over guessing wrong.
5. **Resolve Anina Mu in PagerDuty** (user id for responders) and **in Slack** (member id for `<@…>`).
6. **Check for an existing open incident (before `create_incident`)**
   - Call **`list_incidents`** with `query_model.status` **`["triggered", "acknowledged"]`** (only open incidents). When the target service is known, set **`service_ids`** to that service’s id to avoid scanning unrelated services. Use a sensible **`limit`**. If the schema’s **`sort_by`** allows it, prefer **newest first** (e.g. **`created_at:desc`** or **`incident_number:desc`**) so recent candidates appear first—**do not** use field names that the schema’s enum does not list.
   - **Matching rules** (use **only** user-authored title/description from this chat—same minimization as elsewhere; **do not** infer extra keywords from the repo or files):
     - **Strong match:** Normalize the user’s **title** (and short distinctive phrases from their description if needed): lowercase, collapse whitespace. Compare to each candidate incident’s **`title`** and **`summary`** from the list response. Treat as the **same issue** if there is clear overlap: e.g. shared distinctive non-trivial tokens (not generic words like “outage”, “error”, “issue” alone), or one contains the other as a meaningful phrase **and** the service matches.
     - **Explicit reference:** If the user gave an **incident number** or **API id** in chat, resolve that incident among open incidents on the service (or globally if they gave the id)—that incident is the duplicate target.
     - **No confident match:** Proceed to **new incident** creation (step 6).
     - **Multiple plausible matches:** **Stop** and ask the user which incident to bump (list **incident #**, **title**, **status**) or whether to open a **new** incident. Do **not** pick arbitrarily.
   - **If exactly one duplicate target is identified:**
     - **Do not** call **`create_incident`**.
     - Call **`add_note_to_incident`** with that incident’s **`id`** and a **bump note**: redacted user context (what changed / why bumping), **`Repository:`** HTTPS line, mention **Anina Mu** by name, and a short line like **“Bumped via Cursor /create-pd-incident (duplicate avoided).”**
     - Call **`add_responders`** for **Anina Mu** if the schema allows adding responders to an existing incident and she is not already attached (if the tool or API cannot express “only if missing”, add her per schema and accept idempotent/no-op behavior if documented).
     - Skip steps **6–7** (create). Continue at step **8** using this incident’s **id** (not a newly created one).
7. **Create path only (no duplicate found):** Call **`create_incident`** with at least the **title** and **service** required by the schema. Add **body** / **details** and **urgency** when the schema supports them and the situation warrants it (customer impact → high). The body should include **Anina Mu** by name as specified above, the **`Repository:`** HTTPS line, and **only** other user-sourced (or explicitly user-typed-in-chat), redacted strings.
8. **Create path only:** Call **`add_responders`** (or equivalent) on the **new** incident so **Anina Mu** is tagged as a responder per the schema.
9. **Refresh incident from PagerDuty** — After `create_incident` **or** after bumping an existing incident, call **`get_incident`** with the incident’s **id** (not only the incident number). Use the tool’s **`query_model.include`** array per schema so the payload is useful on Slack — at minimum request **`assignments`** and **`services`**; also include **`users`**, **`escalation_policies`**, **`teams`**, **`notes`**, **`urgencies`**, **`priorities`**, and **`acknowledgers`** when the schema lists them and the response is non-empty. **Do not guess** field names or values: copy labels and values from this `get_incident` response (and from `create_incident` / `add_note_to_incident` only for fields missing from `get_incident`). If `get_incident` fails, post Slack using the best available return values and state that the incident refresh failed.
10. **Slack:** Post to **`C0ATGAPD5HC`** a **structured** message (bullets or short labeled lines) that:
   - **Mentions** Anina with `<@HER_SLACK_USER_ID>` first.
   - **Lead line:** If this was a **bump**, state upfront that the incident **already existed**, was **not** duplicated, and was **bumped** with a new note (include **incident #**). If this was **new**, say **created** as usual.
   - **Repository:** the same **HTTPS** URL as in the PagerDuty incident body or bump note (must be a full link, not a bare repo name).
   - **PagerDuty block** — Populate directly from **`get_incident`** (and create/bump return values only to fill gaps). Include as many of these as the API returns, with exact values:
     - **Title** from the incident record and PD **`summary`** if present—**no** extra workspace-inferred narrative.
     - **Incident #** (`incident_number`), **API id** (`id`), **status**, **urgency** / **priority** (if returned).
     - **Service:** name or `summary` and **service id**.
     - **Timestamps:** `created_at`, `updated_at` (and `resolved_at` if set) — keep ISO or convert to a clear timezone; state which you used once.
     - **Assignments:** each assignee **name** (or `summary`) and **user id** from `assignments`.
     - **Escalation policy** (name/id) and **teams** if `include` returned them.
     - **Acknowledgers** if any.
     - **Recent notes** — if `include` returned notes, paste the **latest** note body or first line (truncate with “…” if very long); otherwise omit.
     - **Link:** `https://anina.pagerduty.com/incidents/<incident_api_id>` (use the `id` from the incident object), or `html_url` if the tool returns it.
   - Keep the message **under ~4000 characters** if needed by tightening notes/details; prefer PD facts over prose. If a PD **note** or body echo could still contain sensitive user data, **redact** those lines before posting (same rules as above) or omit the note field and say omitted for safety.
11. In your reply to the user, include:
   - Whether the workflow **created** an incident or **reused and bumped** an existing one (say **clearly** if it already existed).
   - Incident **number**, **title**, **service**, **urgency**, **status**, and **PagerDuty URL**
   - The **repository HTTPS URL** used
   - Confirmation that **Anina Mu** was added as a **responder** or mentioned (or what failed)
   - That Slack was posted to **C0ATGAPD5HC**, with a **permalink** to the message if the tool returns it

## Constraints

- Do not invent API payloads; follow the tool schemas returned by the MCPs.
- Never print or request API tokens.
- Never bypass **redaction** rules to save time.
- **Deduplication:** Never open a second incident for the **same user-described issue** when **one clear** matching open incident exists—**bump** with **`add_note_to_incident`** instead. When duplicates are **ambiguous**, ask the user rather than creating overlapping incidents.
