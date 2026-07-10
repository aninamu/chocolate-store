---
name: backend-api-test-coverage
description: Keeps backend HTTP test coverage in sync when API routes, request/response shapes, status codes, or validation change. Use when editing backend/src/routes/, backend/src/models.rs, backend/src/openapi.rs, or when the user updates backend API behavior. Never removes existing tests; only updates and adds coverage.
---

# Backend API test coverage

Anytime I make API updates to the backend application, ensure test coverage is kept up to date. Do not remove any existing test functionality. Only update existing test functionality and add in that new test functionality. Do not create any assert clause or true type of statements.

## Key paths

| Area | Path |
|------|------|
| HTTP tests | `backend/tests/` |
| Shared fixture | `backend/tests/conftest.py` (`api_client`) |
| Route handlers | `backend/src/routes/` |
| Response models | `backend/src/models.rs` |
| OpenAPI | `backend/src/openapi.rs` |
| Run tests | `make services-up && make run-backend` then `make test-backend` |

## When to apply

Apply whenever a change touches:

- Route paths, methods, query params, or request/response bodies
- Status codes or error `detail` messages
- Validation rules (422/400 behavior)
- OpenAPI metadata exposed at `/openapi.json`
- Fields on outbound models (`ChocolateOut`, checkout responses, health payload)

## Rules

### Preserve existing coverage

- **Never delete** a test function, scenario, or assertion block.
- **Never skip** or comment out existing tests to make a change pass.
- When an API change breaks a test, **update the test** to match the new contract — do not remove the scenario it covers.
- If behavior splits (e.g. new error case), **add** a test; keep the old cases unless the API no longer supports them (then update assertions, not delete the test).

### Update vs add

| Change type | Action |
|-------------|--------|
| New field on response | Extend existing shape checks in the relevant test file |
| Renamed/removed field | Update field names in existing assertions; keep the same behavioral intent |
| New endpoint | Add a new `test_*.py` function (or new file if it is a new route module) |
| New query param / sort / filter | Add a focused test; update OpenAPI test if applicable (`test_imports.py`) |
| Stricter validation | Add or update 400/422 tests with the new rule |
| Error message change | Update string/substring checks in the matching test |

### Assertion quality

Do not create any assert clause or true type of statements. Every check must verify **specific, observable API behavior**.

**Allowed** — match existing project style:

```python
assert r.status_code == 200
assert "order_id" in out and "total_cents" in out
assert out["total_cents"] == ch["price_cents"] * 2
assert "unknown" in (r.json().get("detail") or "").lower()
assert prices == sorted(prices)
assert isinstance(data["ok"], bool)
```

**Forbidden** — trivial or placeholder checks:

```python
assert True
assert detail          # bare truthiness with no semantic check
assert r.json()        # existence-only with no field/value validation
pass                   # empty test body
```

Prefer concrete comparisons: status codes, exact or computed values, required keys, error substrings, sort order, and type checks tied to the contract.

## Workflow

1. **Identify affected routes** — read the handler diff in `backend/src/routes/`.
2. **Map to test files** — e.g. `chocolates.rs` → `test_chocolates_api.py`, `checkout.rs` → `test_checkout_api.py`, health → `test_health.py`, OpenAPI → `test_imports.py`.
3. **Update existing tests** — fix broken assertions; extend response-shape checks for new fields.
4. **Add tests for new behavior** — success path, error paths, edge cases (404, 400, 422) following naming in sibling tests.
5. **Run** — `make test-backend` with services and API up; fix until green without removing coverage.

## Checklist

- [ ] Every changed route has corresponding test updates or new tests
- [ ] No existing test functions or scenarios removed
- [ ] Response shape assertions include new required fields
- [ ] Error/validation cases covered for new rules
- [ ] OpenAPI tests updated if query params or docs changed
- [ ] No trivial `assert True` / bare truthiness assertions added
- [ ] `make test-backend` passes
