# Bugbot review guide — chocolate-store

This repo is a demo marketplace: **Next.js 15 + Axum (Rust) + Postgres + Redis**. No real user accounts; checkout is mock; the social feed uses demo identities via `X-Demo-User-Id`.

Use this file to tune PR reviews. Focus on **real bugs and regressions**, not style nitpicks.

## Review tone

- Be concise. One comment per distinct issue.
- Prefer actionable fix suggestions over generic advice.
- Skip findings that are intentional demo limitations (listed below).
- Do not flag missing auth on endpoints that are explicitly public demo APIs.

## Always flag

### Backend (`backend/`)

- **SQL injection** — raw SQL, f-string queries, or unsanitized user input in SQLAlchemy filters.
- **Missing input validation** — request bodies bypassing Pydantic schemas or accepting unbounded strings/lists.
- **Broken demo-user authorization** — social write endpoints that ignore `X-Demo-User-Id` or allow acting as another user without checks.
- **Secrets in code** — hardcoded API keys, tokens, or real credentials (`.env` values belong in env vars only).
- **Schema/seed drift** — changes to `backend/src/models.rs` (`ChocolateOut`) without matching updates to `backend/src/seed.rs` or `backend/src/schema.sql`.
- **Unhandled async errors** — missing `try/except` around DB/Redis calls that can leave sessions open or return 500s for predictable validation failures.
- **Cache correctness** — Redis cache keys or TTL changes that could serve stale catalog data after writes.

### Frontend (`frontend/src/`)

- **Accessibility regressions** — missing `alt` on meaningful images, icon-only buttons without labels, click-only interactions with no keyboard path.
- **Broken API integration** — wrong paths, missing error handling, or types in `lib/types.ts` out of sync with OpenAPI responses.
- **State bugs** — cart/saved/demo-user state in `localStorage` (`cs.cart.v1`, `cs.saved.v1`, `cs.demoUser.v1`) corrupted or lost on navigation.
- **Server/client boundary leaks** — `CURSOR_API_KEY` or other secrets referenced from client components or `NEXT_PUBLIC_*` vars.
- **Missing tests for new API routes** — new handlers under `frontend/src/app/api/` should have corresponding tests (see existing `route.test.ts` patterns).

### Cross-cutting

- **New API endpoints without tests** — backend route changes should include or update integration tests under `backend/tests/`.
- **CI breakage** — changes that would fail `backend-tests` or `frontend-tests` GitHub Actions workflows.

## Usually ignore (demo scope)

- No real authentication system — demo user picker is by design.
- Mock checkout — no payment processor, no PCI scope.
- Database wiped on every `make dev` — migrations are not used; schema comes from SQLAlchemy models.
- Redis cache is optional — backend degrades gracefully without Redis.
- External Unsplash images — already allowlisted in `frontend/next.config.ts`.
- Coverage thresholds — reports are informational only; do not require 100% coverage.

## Test expectations

| Area changed | Expect |
|--------------|--------|
| `backend/src/routes/**` | New or updated tests in `backend/tests/` |
| `backend/src/models.rs` | Sync `backend/src/seed.rs` if output shape changed |
| `frontend/src/app/api/**` | Vitest route tests alongside the handler |
| `frontend/src/components/**` | Tests when behavior is non-trivial (follow existing `*.test.tsx` patterns) |

If a PR changes backend routers but includes no test changes, flag it unless the diff is docs-only or a one-line typo fix.

## Modular rules (optional)

Link out to detailed rule files when you want scoped guidance. Bugbot follows these links and includes their content.

- [Backend security checklist](../.cursor/agents/backend-security-scanner.md)
- [Frontend a11y checklist](../.cursor/agents/frontend-a11y-scanner.md)
- [Plan before building](../.cursor/rules/plan-before-building.mdc)

## Example blocking findings

Use language like this when reporting:

> **Schema/seed drift:** `ChocolateOut` gained a required field but `seed.py` was not updated. Catalog seed will fail validation on startup.

> **IDOR on social API:** `DELETE /api/posts/{id}` does not verify the post author matches `X-Demo-User-Id`.

> **Missing test:** New `POST /api/checkout` validation branch has no integration test coverage.

## False positives to suppress

If you see these, do **not** comment:

- `CURSOR_API_KEY` read only in server routes under `frontend/src/app/api/dev-mode/`
- CORS permissive settings in local dev config
- Hardcoded demo user IDs in `seed.py`
- `console.log` in Dev mode components

When a finding is wrong, resolve the thread and update this file so it does not recur.
