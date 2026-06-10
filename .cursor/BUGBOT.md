# Bugbot review guide — chocolate-store

This repo is a demo marketplace: **Next.js 15 + FastAPI + Postgres + Redis**. It is a
**read-only catalog + mock checkout**, plus an in-app **Dev mode** that drives Cursor cloud
agents via `@cursor/sdk`. There are no real user accounts, no payment processor, and no
social feed.

Use this file to tune PR reviews. Focus on **real bugs and regressions**, not style nitpicks.

## Review tone

- Be concise. One comment per distinct issue.
- Prefer actionable fix suggestions over generic advice.
- Skip findings that are intentional demo limitations (listed below).
- Do not flag missing auth on endpoints that are explicitly public demo APIs.

## What actually exists

Knowing the real surface area prevents hallucinated findings about features that aren't here.

### Backend API (`backend/app/`)

- `GET /api/chocolates` — catalog list. Query params: `tag` (repeatable, OR semantics),
  `sort` (`name | price_asc | price_desc | cacao_desc`), `available` (bool). Cached in Redis.
- `GET /api/chocolates/{chocolate_id}` — single chocolate by UUID. Cached in Redis.
- `POST /api/checkout` — mock checkout. Validates via Pydantic, checks each item exists and
  is `in_stock`, writes `Order` + `OrderItem` rows. Does not charge or decrement stock.
- `GET /api/health` — liveness/shape check.

There are **no** user, auth, posts, likes, follows, or other social endpoints. Do not invent
IDOR or demo-identity findings for routes that don't exist.

### Frontend (`frontend/src/`)

- App Router pages: `shop`, `cart`, `checkout`, `saved`, `about`.
- Dev-mode API routes (server-only): `POST/GET/DELETE /api/dev-mode/agent` and
  `POST /api/dev-mode/agent/send`. These use `CURSOR_API_KEY` and `@cursor/sdk`.
- Shop state + `localStorage` live in `context/shop-state.tsx`.

## Always flag

### Backend (`backend/`)

- **SQL injection** — raw SQL, f-string queries, or unsanitized user input in SQLAlchemy
  filters. (Existing code uses the SQLAlchemy expression API — keep it that way.)
- **Missing input validation** — request bodies bypassing the Pydantic schemas in
  `backend/app/schemas/chocolate.py`, or accepting unbounded strings/lists. Checkout
  quantities are bounded (1–99); don't loosen that.
- **Schema/seed drift** — changes to `backend/app/schemas/chocolate.py` or the SQLAlchemy
  models in `backend/app/models/chocolate.py` without matching updates to
  `backend/app/seed.py` and the insert mapping in `backend/app/init_db.py`. The DB is wiped
  and reseeded on every `make dev`, so a field mismatch breaks startup. See
  `.cursor/skills/sync-seed-with-schema/SKILL.md`.
- **Cache correctness** — `backend/app/cache.py` keys and TTL. Two specific traps:
  - The Redis list cache key (`_list_cache_key`) is built only from `tag` + `sort`. If you
    add a new filter param (like the existing `available`) without adding it to the key,
    cache hits will serve responses that ignore the filter. **Any new query param that
    changes results must be part of the cache key.**
  - There is **no** cache invalidation. If you add a write path that mutates the catalog,
    add explicit invalidation — otherwise stale data is served for up to `cache_ttl_seconds`.
- **Unhandled async errors** — DB calls that can leave sessions open or return a 500 for a
  predictable validation failure (use `HTTPException` with a 4xx instead). Redis errors are
  intentionally swallowed in `cache.py` (graceful degradation) — that pattern is fine.
- **Secrets in code** — hardcoded API keys, tokens, or real credentials. Config comes from
  env vars only via `backend/app/config.py` (`DATABASE_URL`, `REDIS_URL`, `CACHE_TTL_SECONDS`).

### Frontend (`frontend/src/`)

- **Server/client boundary leaks** — `CURSOR_API_KEY` (or any non-`NEXT_PUBLIC_*` secret)
  referenced from a client component. It must stay inside server route handlers under
  `frontend/src/app/api/dev-mode/`. Only `NEXT_PUBLIC_API_URL` is safe on the client.
- **Broken API integration** — wrong paths against the FastAPI backend, missing error
  handling in `lib/api.ts`, or hand-written types in `lib/types.ts` drifting from backend
  responses (`ChocolateOut`, `CheckoutIn`, `CheckoutOut`). Types are maintained by convention,
  not codegen — verify them against the schemas when shapes change.
- **State bugs** — cart/saved state in `localStorage` (`cs.cart.v1`, `cs.saved.v1`) corrupted
  or lost on navigation, or the `chocolate-store-storage` sync event breaking cross-tab state.
- **Accessibility regressions** — missing `alt` on meaningful images, icon-only buttons
  without labels, click-only interactions with no keyboard path.

### Cross-cutting

- **New API endpoints without tests** — backend router changes should add or update pytest
  coverage under `backend/tests/`; new frontend route handlers should add a Vitest
  `route.test.ts` alongside the handler.
- **CI breakage** — changes that would fail the `backend-tests` or `frontend-tests` jobs in
  `.github/workflows/ci.yml`.

## Usually ignore (demo scope)

- No real authentication system — all APIs are public demo endpoints by design.
- Mock checkout — no payment processor, no PCI scope, and stock is not decremented.
- Database wiped on every `make dev` — no migrations; schema comes from SQLAlchemy models and
  seed data from `backend/app/seed.py`.
- Redis cache is optional — backend degrades gracefully when Redis is unreachable.
- External Unsplash images — `images.unsplash.com` is already allowlisted in
  `frontend/next.config.ts`.
- Coverage thresholds — reports are informational only; do not require 100% coverage.
- In-memory Dev mode agent store (`frontend/src/server/dev-mode-agents.ts`) — not persisted
  across restarts, by design for the demo.

## Test expectations

| Area changed | Expect |
|--------------|--------|
| `backend/app/routers/**` | New or updated tests in `backend/tests/` |
| `backend/app/schemas/**` or `backend/app/models/**` | Sync `backend/app/seed.py` + `init_db.py` if the output/row shape changed |
| `frontend/src/app/api/**` | A Vitest `route.test.ts` alongside the handler (note: `agent/route.ts` currently lacks one) |
| `frontend/src/components/**` | Tests when behavior is non-trivial (follow existing `*.test.tsx` patterns) |

If a PR changes backend routers but includes no test changes, flag it unless the diff is
docs-only or a one-line typo fix.

## Modular rules (optional)

Link out to detailed rule files when you want scoped guidance. Bugbot follows these links and
includes their content. These files are versioned in git:

- [Backend security checklist](agents/backend-security-scanner.md)
- [Frontend a11y checklist](agents/frontend-a11y-scanner.md)
- [Plan before building](rules/plan-before-building.mdc)

## Example blocking findings

Use language like this when reporting:

> **Schema/seed drift:** `ChocolateOut` gained a required field but `seed.py` / `init_db.py`
> were not updated. Catalog reseed will fail validation on the next `make dev`.

> **Stale cache:** new `min_cacao` filter added to `list_chocolates` but not included in
> `_list_cache_key`. Cache hits return results that ignore the filter.

> **Secret leak:** `CURSOR_API_KEY` is read inside a client component instead of the
> `/api/dev-mode/agent` server route.

> **Missing test:** new `POST /api/checkout` validation branch has no pytest coverage.

## False positives to suppress

If you see these, do **not** comment:

- `CURSOR_API_KEY` read only in server routes under `frontend/src/app/api/dev-mode/`.
- Swallowed Redis errors in `backend/app/cache.py` (intentional graceful degradation).
- CORS-permissive settings in local dev config.
- `console.log` in Dev mode components.
- Missing auth on the public catalog/checkout/health endpoints.

When a finding is wrong, resolve the thread and update this file so it does not recur.
