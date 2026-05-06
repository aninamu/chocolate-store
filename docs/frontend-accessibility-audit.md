# Frontend Accessibility Audit

Audit of the Next.js 15 frontend (`frontend/src/...`) covering the home, shop, product detail, saved, cart, checkout, checkout-success pages, the shared `Header`/`CartDrawer` and the in-app `DevMode` panel.

## How this was tested

- **Manual code review** of every page under `frontend/src/app/**` and every component under `frontend/src/components/**` with a focus on semantics, ARIA, keyboard support, alt text, label associations and focus management.
- **Automated `axe-core` scan** (via `@axe-core/puppeteer`, headless Chrome, viewport 1280×900) on every public route in two passes:
  1. Static page loads: `/`, `/shop`, `/saved`, `/cart` (empty), `/checkout` (empty), `/checkout/success?...`, `/shop/<id>`.
  2. Interactive states: cart drawer open with an item, shop tag dropdown open, mobile menu open, dev-mode rail open, `/cart` and `/checkout` with items in `localStorage`.
- Tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `best-practice`.

Raw scan output is reproducible by running the dev stack (`make dev`) and the scripts in `/tmp/a11y/scan.mjs` and `/tmp/a11y/scan-interactive.mjs` (not committed).

---

## Severity summary

| Severity | Count | Notes |
|---|---|---|
| Critical | **2** | unlabeled cart quantity input; invalid `role="listbox"` containing checkbox children |
| Serious | **2** | listbox missing accessible name; toggle buttons with stateful `aria-label` instead of `aria-pressed` |
| Moderate | **3** | dev-mode UI outside any landmark; duplicate adjacent links on product cards; non-unique `aria-label`s in cart drawer |
| Minor / best-practice | **6** | no skip-link, missing `aria-expanded`/`aria-controls` on mobile menu, cart count not announced, sub-100% text opacity contrast risk, missing `aria-describedby` on cart `Sheet`, etc. |

---

## Findings

### 1. CRITICAL — `<input type="number">` on `/cart` has no label

**File:** `frontend/src/app/cart/page.tsx`, lines ~84–91

```tsx
<input
  type="number"
  min={0}
  max={99}
  className="..."
  value={l.quantity}
  onChange={(e) => setQty(l.chocolateId, Number(e.target.value) || 0)}
/>
```

Confirmed by axe (`label`, impact: critical):

> Form elements must have labels — Element does not have an implicit (wrapped) `<label>`, no explicit `<label>`, no `aria-label`, no `aria-labelledby`, no title, no placeholder.

A screen reader reads this only as “spin button, 2”. The cart drawer (`CartDrawer.tsx`) labels the equivalent input with `aria-label="Quantity"`; the page-level cart was missed.

**Fix:** add `aria-label={\`Quantity for ${p.name}\`}` (and ideally use the same label-with-product-name pattern in the drawer too — see Finding 7).

<img alt="Cart page quantity input highlighted with no associated label" src="/opt/cursor/artifacts/a11y_cart_unlabeled_qty_input.png" />

---

### 2. CRITICAL / SERIOUS — Tag picker uses `role="listbox"` incorrectly

**File:** `frontend/src/app/shop/page.tsx`, lines ~167–207 (`TagMultiselectDropdown`)

```tsx
<div role="listbox" aria-multiselectable className="...">
  ...
  <label htmlFor={id} ...>
    <input id={id} type="checkbox" ... />
    <span>{t}</span>
  </label>
  ...
</div>
```

Confirmed by axe:

- `aria-required-children` (**critical**) — “Element has children which are not allowed: input[tabindex]”. A `listbox` is only allowed to contain `option` / `group` children (and `group` only allows `option`); native `<input type="checkbox">` is not permitted.
- `aria-input-field-name` (**serious**) — the `listbox` itself has no `aria-label` / `aria-labelledby`. The associated `<Label htmlFor=...>Tags</Label>` is on the **trigger button**, not the listbox.

This combination breaks the assistive-tech model. Screen readers in NVDA/JAWS forms mode will treat the popup as a listbox and silently skip the checkbox children, giving zero way to actually pick a tag.

**Fix (recommended):** drop the `role="listbox"` / `aria-multiselectable` entirely and present the popup as a `role="group"` (or `role="dialog"`) with `aria-label="Tags"` (or `aria-labelledby={triggerId}`). Native checkbox + visible `<label>` already gives correct semantics. The trigger should keep `aria-haspopup` but use `"dialog"` / `"menu"` instead of `"listbox"`.

If a true listbox is required, the children must each be `<div role="option" aria-selected={...}>` and the component needs full keyboard handling (Up/Down/Home/End/Space/Enter/typeahead).

<img alt="Shop page tag dropdown highlighted, demonstrating misuse of role=listbox" src="/opt/cursor/artifacts/a11y_shop_listbox_misuse.png" />

---

### 3. SERIOUS — Toggle buttons use changing `aria-label` instead of `aria-pressed`

**Files:**

- `frontend/src/components/ChocolateCard.tsx`, lines ~78–86 (heart save)
- `frontend/src/app/shop/[id]/page.tsx`, lines ~97–105 (heart save on detail page)

```tsx
<Button
  type="button"
  size="icon"
  variant={saved ? "default" : "outline"}
  aria-label={saved ? "Unsave" : "Save for later"}
  onClick={() => toggleSaved(c.id)}
>
  <Heart className={`size-4 ${saved ? "fill-current" : ""}`} />
</Button>
```

This works (state is conveyed) but isn’t the WAI-ARIA toggle-button pattern. Screen readers won’t identify it as a toggle, so users don’t hear the consistent “toggle button, pressed/not pressed” affordance and the “name” changes between activations, which is jarring with verbose voicing.

**Fix:** use a stable `aria-label="Save for later"` and add `aria-pressed={saved}`.

---

### 4. MODERATE — Dev-mode UI sits outside any landmark on every page

**File:** `frontend/src/components/DevMode.tsx`, `DevModeToggle` (lines ~1470–1521)

axe `region` violation on **every** scanned route:

> `<label for="dev-mode-switch">Dev mode off</label>` — Some page content is not contained by landmarks.

The toggle is rendered as a fixed-position `<div>`. It is not inside `<header>`, `<main>`, `<nav>`, `<aside>` or `<footer>`. With dev mode on, an additional `<span data-testid="dev-mode-agent-status">` joins the violation. The right-side rail is correctly an `<aside>`; the toggle is the orphan.

**Fix:** wrap the toggle in `<aside aria-label="Dev mode controls">` (or render it inside the existing `<aside data-testid="dev-mode-rail">`). This is a one-line change.

<img alt="Dev mode toggle highlighted, sitting outside any landmark" src="/opt/cursor/artifacts/a11y_dev_mode_outside_landmark.png" />

---

### 5. MODERATE — Two adjacent links with overlapping accessible names per product card

**File:** `frontend/src/components/ChocolateCard.tsx`, lines ~26–47

```tsx
<Link href={`/shop/${c.id}`} className="block">
  <div ...>
    <Image src={c.image_url} alt={c.name} fill ... />
    ...
  </div>
</Link>
...
<Link href={`/shop/${c.id}`} className="line-clamp-1 ...">
  {c.name}
</Link>
```

Each card produces two consecutive links to the **same** URL. The first link’s accessible name comes from the image `alt` (the product name), and the second link’s name is the same product name. In a screen-reader links list, every product appears twice with identical names, making the list ~2× as long and harder to scan. Keyboard users also have to Tab through duplicate stops.

**Fix options (pick one):**

- Wrap the entire card in **one** `<Link>` and remove the inner one; use `tabIndex={-1}` on the inner `<a>` if needed.
- Keep both links but make the image link decorative for AT: set the image `alt=""`. The first link will then have no accessible name and `axe`/eslint-jsx-a11y will flag it; the cleanest path is the single-wrapper approach above.

---

### 6. MODERATE — `CartDrawer` quantity inputs and remove buttons share identical names

**File:** `frontend/src/components/CartDrawer.tsx`, lines ~72–91

```tsx
<input ... aria-label="Quantity" ... />
<Button ... aria-label="Remove">
  <Trash2 className="size-4" />
</Button>
```

When the drawer has multiple items, a screen-reader user navigating by form fields hears “Quantity, spin button” and “Remove, button” N times with no way to distinguish which line item each control affects.

**Fix:** include the product name in each label:

```tsx
aria-label={`Quantity for ${p?.name ?? "item"}`}
aria-label={`Remove ${p?.name ?? "item"}`}
```

The same applies to the `aria-label="Quantity"` in `cart/page.tsx` once Finding 1 is addressed.

---

### 7. MINOR — Mobile menu trigger missing `aria-expanded` / `aria-controls`

**File:** `frontend/src/components/Header.tsx`, lines ~47–55

```tsx
<Button ... aria-label="Menu" onClick={() => setMobile((v) => !v)}>
  <Menu className="size-4" />
</Button>
...
{mobile ? (<div className="...">...links...</div>) : null}
```

The trigger never advertises its state. Add:

```tsx
aria-expanded={mobile}
aria-controls="mobile-nav"
```

and `id="mobile-nav"` plus `role="navigation"` (or wrap in `<nav>`) on the disclosed panel.

---

### 8. MINOR — Cart count badge not announced

**File:** `frontend/src/components/Header.tsx`, lines ~56–69

The cart trigger is `aria-label="Open cart"` regardless of how many items are in the cart. The visual `1`/`2`/`9+` badge is invisible to screen readers.

**Fix:** make the count part of the accessible name:

```tsx
aria-label={count > 0 ? `Open cart, ${count} item${count === 1 ? "" : "s"}` : "Open cart"}
```

and consider `aria-live="polite"` on a hidden status element so the count change is announced when items are added.

---

### 9. MINOR — No skip-to-content link

**File:** `frontend/src/app/layout.tsx`

The header has primary nav, a cart button and (in dev) a fixed dev-mode toggle. Keyboard users have to Tab through all of those before reaching page content on every page. A `<a href="#main" className="sr-only focus:not-sr-only ...">Skip to main content</a>` plus `id="main"` on `<main>` is the standard remedy.

---

### 10. MINOR — `Sheet` (cart drawer) has no description

**File:** `frontend/src/components/CartDrawer.tsx`, line ~36

`<SheetHeader><SheetTitle>Your cart</SheetTitle></SheetHeader>` — no `SheetDescription`. Base UI’s dialog primitive prefers an `aria-describedby` so screen readers get a brief description in addition to the title (otherwise some readers fall back to reading the entire dialog content). Add a visually hidden `<SheetDescription className="sr-only">Items in your shopping cart</SheetDescription>`.

---

### 11. MINOR — Sub-100% text opacity on partly-transparent backgrounds

**Files:**

- `frontend/src/components/DevMode.tsx`: `text-muted-foreground/70` (toggle label), `text-muted-foreground/80` (agent status), `text-muted-foreground/70` over `bg-card/40 backdrop-blur-md` (toggle wrapper).
- Various card overlays use `from-black/25` and similar gradient overlays under text.

Axe couldn’t compute a definitive ratio for ~10–16 elements per page (`color-contrast` listed in **incomplete**, not violations) because of alpha layers, gradients and backdrop blur. Applying alpha-on-alpha shaves enough contrast that several of these are likely below WCAG AA (4.5:1 for body text, 3:1 for large text) on the lighter half of each viewport.

**Suggested action:** drop the `/70` and `/80` opacity modifiers on `text-muted-foreground` (the base `--muted-foreground` already has reduced contrast by design), and verify the home-page hero pill (`text-primary` on `bg-primary/10`) and product-card image overlay text against a sample background using e.g. https://contrast-grid.eightshapes.com/.

---

## Suggested fix order

1. **Quick wins (1 file each, low risk):**
   - Add `aria-label` to the `/cart` quantity input (Finding 1).
   - Wrap the dev-mode toggle in `<aside>` (Finding 4).
   - Mobile menu `aria-expanded`/`aria-controls` (Finding 7).
   - Cart count in `aria-label` (Finding 8).
   - Skip-to-content link in `layout.tsx` (Finding 9).
2. **Toggle pattern + per-item labels:**
   - Heart buttons → `aria-pressed` (Finding 3).
   - Cart drawer per-item labels (Finding 6).
3. **Tag picker rework** (Finding 2) — small refactor of `TagMultiselectDropdown`.
4. **Card link de-duplication** (Finding 5) — touches every product list.
5. **Color-contrast pass** (Finding 11) — design review on muted text and overlays.

## Recommended tooling additions

- Add `eslint-plugin-jsx-a11y` (already implicit via `next/core-web-vitals` but only a subset of rules is enabled). Consider extending with `plugin:jsx-a11y/strict`.
- Add a vitest + `@axe-core/playwright` (or `vitest-axe`) check in CI that scans each page on the running dev server. The two scripts used for this audit can be lifted directly into `frontend/test/a11y.spec.ts`.
