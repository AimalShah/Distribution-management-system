# Checkpoint Implementation Status

**Last updated:** 2026-10-04
**Repo:** `Distribution-management-system`
**Branch:** `main` @ `64e70d6`, plus `feat/02-api-parity` (stacked on PR #21, in review)

Status of every checkpoint in `checkpoints/`, derived from what is actually on `main` —
not from what a `plan.md` claims.

---

## Legend

| Status | Meaning |
|---|---|
| **Implemented** | Code exists on `main`, routes mounted, tests pass |
| **Partial** | Some parts landed, others missing or unmounted |
| **Planned** | Only `plan.md` + `plan.lock` exist. No code. |
| **Spec only** | Plan exists, acceptance test is an empty stub |

---

## Summary

| Area | Status |
|---|---|
| 00 — Harness + Monorepo Scaffold | **Implemented** |
| 01 — Shared Packages | **Implemented** |
| 02a–02o — Express API | **Implemented** — all 15 parity suites `gated` (279 tests); 2j/2k mounted in `app.ts` |
| 03 — Auth | **Implemented** (PR pending review) — better-auth sessions; header mode kept only as opt-in trusted-proxy |
| 04a — Dashboard + web shell | **Implemented** (PR pending review) |
| 04b — Product pages | **Implemented** (PR pending review) |
| 04c — Purchase pages | **Implemented** (PR pending review) |
| 04d — Sale invoice pages | **Implemented** (PR pending review) |
| 04e — Inventory page | **Implemented** (PR pending review) |
| 04f–04j — React Web App | **Planned** |
| 05 — Electron Shell | **Partial** |
| 06 — RBAC Rebuild | **Planned** |
| 07–12 — Domain features | **Spec only** |

**The API layer is done. There is no UI.**

---

## 00 — Harness + Monorepo Scaffold · Implemented

Monorepo works: Turborepo + pnpm workspaces, `apps/{web,server,desktop}`,
`packages/{ui,db,shared,config-eslint,config-typescript}` all exist.

`apps/server/src/harness/router.ts` now exists and is the real thing: validated
service/function dispatch, traversal rejection, argument limits, a `/state` route, and a
`/call` route. Ten tests cover it, and `apps/server/src/routes/__debug.ts` re-exports it
instead of holding an inline handler. The devtools CLI (`call`, `state`, `render`,
`screenshot`, `diff`) drives the same endpoints.

## 01 — Shared Packages · Implemented

`packages/shared` has `pagination.ts`, `inputs.ts`, and 15 schemas (auth, product, purchase,
sale, return, inventory, customer, supplier, organization, member, category, brand, report).

`packages/ui` has all 28 shadcn components plus `data-table` and a `date-range` picker that
shadcn does not ship, re-exported from `src/index.ts`. Two constraints are worth knowing
before editing anything in there, because both fail silently until something is consumed:

- **No `@/` path aliases.** `@dms/ui` ships raw TypeScript (`main: ./src/index.ts`), so the
  consuming app's `tsc` compiles these files with the *app's* tsconfig. An `@/lib/utils`
  import resolves here and nowhere else, and the breakage lands on every component at once
  with no error in this package. `packages/shared` already works this way; the parity test
  enforces it.
- **The theme is imported by the app, not the package.** `packages/ui/src/theme.css` holds
  the shadcn tokens but deliberately does not `@import "tailwindcss"`, which is not
  resolvable from this package. `apps/web/src/index.css` imports Tailwind first and the
  theme second, and `@source`s `packages/ui/src` so the components' utility classes are
  actually generated. Both paths are relative to the stylesheet, and both were wrong by one
  level until the parity test caught it — Tailwind ignores a bad `@source` without a word.

## 02 — Express API · Implemented

| ID | Checkpoint | PR | Status | Routes |
|---|---|---|---|---|
| 02a | Product | #5 | Implemented | `/api/products` |
| 02b | Purchase | #3 | Implemented | `/api/purchases` |
| 02c | Sale Invoice | #4 | Implemented | `/api/sales` |
| 02d | Inventory | #6 | Implemented | `/api/inventory` |
| 02e | Return | #7 | Implemented | `/api/returns` |
| 02f | Customer | #8 | Implemented | `/api/customers` |
| 02g | Supplier | #9 | Implemented | `/api/suppliers` |
| 02h | Category | #10 | Implemented | `/api/categories` |
| 02i | Brand | #11 | Implemented | `/api/brands` |
| 02j | Organization | #12 | **Partial** — router built, **not in `routes/index.ts`**; mounted separately in `app.ts` |
| 02k | Members | #13 | **Partial** — same, mounted in `app.ts` not the API router |
| 02l | Permissions | #14 | Implemented — `requireAdmin` + `isAdmin`/`getMemberRole` exist and are tested; wiring to a route is deliberately deferred to checkpoint 6 |
| 02m | Inventory Reports | #15 | Implemented | `/api/reports/inventory` |
| 02n | Purchase Reports | #16 | Implemented | `/api/reports/purchase` |
| 02o | Sales Reports | #17 | Implemented | `/api/reports/sales` |

12 routers registered in `apps/server/src/routes/index.ts`. Organization and members
are mounted directly in `app.ts` instead — intentional (documented in a comment
there) because their paths need the bootstrap context rather than a tenant header.
Worth knowing before you add a route that expects them in the shared router.

**630 tests pass, `tsc --noEmit` clean.**

### Defects found and fixed in review (PR #18 + per-checkpoint fixes)

| Defect | Fixed in |
|---|---|
| Member roster leaked other tenants' names + emails (membership check resolved then discarded) | #13 |
| `adminRole` could grant **and** revoke ownership | #13 |
| Last-owner check was a TOCTOU race (count and write in separate statements) | #13 |
| `Member` had no unique index on `(organizationId, userId)` | #18 |
| `SaleItem`/`PurchaseItem`/`ReturnItem` lacked `onDelete: Cascade` | #18 |
| Products accepted cross-tenant `categoryId` / `brandId` | #18 |
| Supplier detail embedded every purchase ever billed | #9 |
| 4 report endpoints loaded every row into JS | #16, #17 |
| Active-session lookup ignored `expiresAt` | #12 |
| `setActiveOrganization` returned 204 on a zero-row write | #12 |
| `totalLineItems` on the purchase report counted *purchases with lines*, not lines (Prisma `groupBy` rows are keyed on `purchaseId`, so one group is one purchase) | `feat/02-api-parity` |
| `totalLineItems` on the sales report had the same defect, keyed on `saleId` | `feat/02-api-parity` |
| `removeMember` checked the member's *current* role instead of the role being changed, so it could strip ownership from a second owner | `feat/02-api-parity` |
| Deleting a sale left the units it sold missing from inventory. Now returned with an `IN` log entry in the same transaction; refused (409) when a return references the invoice | `checkpoint/04d-sale-invoice` |
| Deleting a purchase left all of its stock in `Inventory.quantityOnHand` with no log entry. Now reversed in the same transaction, refused (409) when the stock was already consumed or a return references the purchase | `checkpoint/04c-purchase` |

## 03 — Auth · Implemented (PR pending review)

`apps/server/src/auth/` configures better-auth (Prisma adapter, email/password, Resend
verification, organization + admin + bearer plugins), mounted at `/api/auth/*`.
`middleware/session.ts` fills `req.auth` from the session: 401 without one, 400
`ORGANIZATION_REQUIRED` with no active organization, 403 `NOT_A_MEMBER` when the session's
active organization has no `Member` row for the user (re-checked per request, because removing
a member does not rewrite their sessions).

The old header shim now exists only as **trusted-proxy mode** (`DMS_TRUSTED_PROXY_AUTH=true`),
for deployments behind an authenticating gateway. The mocked server suite and the 02 parity
suites run in that mode; `checkpoints/03-auth/parity.test.ts` (20 tests, real database) covers
the session path. Production refuses to start without a 32+ character `BETTER_AUTH_SECRET`.

Deviations from the legacy config, both security fixes:

| Legacy | Now | Why |
|---|---|---|
| `admin({ defaultRole: "admin" })` | `defaultRole: "user"` | The admin role is global: every sign-up could list, ban and delete every tenant's users |
| `organizationId` writable at sign-up | `input: false` | A client-written tenant pointer is the checkpoint-2 defect pattern |

Migration `0002_auth_invitation_created_at` adds `invitation.createdAt`, which the organization
plugin writes. `apps/web` has `lib/auth-client.ts` and `hooks/use-auth.ts` (better-auth's own
`useSession`, which refreshes itself on sign-in/out and org switch, instead of SWR).

## 04 — React Web App · In progress (04a–04e done)

> The text below describes the state before 04a and is kept for history. 04a added the
> app shell (lazy routes, `RequireAuth`, sidebar layout, login/sign-up/register-company
> screens) and the dashboard. The parity gate now accepts sub-checkpoint entries, so
> `04-react-web-app/04a-dashboard` is `gated` while the rest of 04 stays `pending`.
> DOM suites opt into jsdom with a docblock and render through
> `apps/web/src/test/render.tsx`, which answers SWR keys by API path.

`apps/web` is 4 files. The whole app:

```tsx
<Route path="/" element={<div>Inventioo DMS</div>} />
```

- `packages/ui` — one component: `DataTable` (TanStack, manual pagination)
- `apps/desktop` — Electron shell, 1400×900, loads web dev server or built bundle
- `apps/web/src/lib/api.ts` — axios + Bearer interceptor

No pages, no forms, no auth flow, no navigation. Every route merged in checkpoint 2 has
zero screens calling it. Each sub-checkpoint below is a written plan only — **no `.tsx` files
exist anywhere in `checkpoints/`**.

| ID | Checkpoint | Status |
|---|---|---|
| 04a | Dashboard | **Implemented** (PR pending review) — plus the shell every screen shares: routing, auth screens, sidebar, SWR. `GET /api/dashboard/stats` replaces browser-side sums; the legacy constant trends and `Math.random()` figures are gone |
| 04b | Product Pages | **Implemented** (PR pending review) — list with server pagination/search, shared new/edit form, confirmed delete, inline category/brand creation |
| 04c | Purchase Pages | **Implemented** (PR pending review) — list, new purchase with dynamic lines and live totals (shared `calculatePurchaseTotal`), header-only edit |
| 04d | Sale Invoice Pages | **Implemented** (PR pending review) — list, new invoice with live totals and stock warnings, `/sales/:id/print` (escaped HTML, CSP) and `/sales/:id/pdf` (same HTML through puppeteer-core) |
| 04e | Inventory Page | **Implemented** (PR pending review) — stock and movement-log tabs, adjust dialog, add-inventory form rebuilt against `InventoryCreateSchema` |
| 04f | Returns Pages | Planned |
| 04g | Customer Page | Planned |
| 04h | Supplier Page | Planned |
| 04i | Reports Page | Planned |
| 04j | Settings Pages | Planned |

## 05 — Electron Shell · Partial

`BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, preload script, and
dev/prod load paths all present. Acceptance test asserts 6 things but has no real Electron
runtime behind it.

## 06–12 — Domain features · Spec only

Plans exist. **Every acceptance test is an empty stub** — test names with `{}` bodies:

| ID | Checkpoint | Empty stubs |
|---|---|---|
| 06 | RBAC Rebuild | 7 of 7 |
| 07 | Batch/Lot Inventory + Expiry KPI | 7 |
| 08 | GST Fields + Sale Tax Invoice | 6 |
| 09 | Brand-Scoping on Sale/Purchase | 5 |
| 10 | Bulk Import, Wired for Real | 7 |
| 11 | Return Policy, Credit Terms, Customer GST | 6 |
| 12 | Client's Invoice Layout Swap-In | 6 |

Checkpoint 6 matters more than its empty tests suggest: it owns reconciling the role
vocabulary. `Member.role` is a plain `String` with three competing spellings in the codebase —
`Member.role` uses `owner`/`adminRole`, `User.role` spells it `admin`, and `prisma/seed.ts`
writes `ADMIN` and `STAFF`. Role comparisons are case-sensitive on purpose, so a row saying
`ADMIN` is not elevated.

---

## Build and test

```bash
# API tests — 630 pass
pnpm --filter server run test

# Typecheck (all workspaces)
pnpm run typecheck

# Prisma client (required before typecheck on a fresh clone)
pnpm --filter @dms/db exec prisma generate

# Checkpoint parity — the gated set CI enforces
pnpm run test:parity

# Every parity suite, including the ones still `pending`
pnpm run test:parity:all
```

The parity suites under `checkpoints/` are outside the pnpm workspace globs, so they resolve
`@dms/*` through the aliases in `vitest.config.ts` rather than `node_modules`.

### CI status

All three fitness-function jobs pass:

| Job | Status |
|---|---|
| `bundle-size` | Passes — configured by `apps/web/.size-limit.json`. Since 04a it measures the built files (`@size-limit/file`), not a re-bundle: **entry 161.8 / 175 kB**, dashboard chunk 92.9 / 110 kB. The all-routes ceiling is 400 kB since 04e (332 kB then): it sums every lazy chunk and exists to catch duplicated chunks, not to model a download. |
| `checkpoint-parity` | Passes — runs `pnpm run test:parity` against a real PostgreSQL (the parity gate) plus the server suite (`pnpm --filter @dms/server test`, 630 tests). |
| `table-pagination-check` | Passes, but still vacuously: `apps/web/src` has no `<table>` yet. It becomes meaningful with checkpoint 4. |

**What the parity job actually enforces is now declared, not implied.**
`checkpoints/parity-gate.ts` lists every checkpoint as `gated` or `pending`, each `pending`
with the reason it is not enforced, and `checkpoints/parity-gate.test.ts` fails if a
checkpoint gains a parity suite without a decision, or if a `gated` entry matches no files
on disk. `00`, `01` and `02` are now `gated`. `pnpm run test:parity` (the gated set CI
enforces) is **19 files / 279 tests, all passing**; `pnpm run test:parity:all` runs every
suite, and the only remaining failures there are the `03-auth` HTTP tests, which are meant to
fail against the header-trust shim until checkpoint 3 lands.

The server suite runs alongside it. It mocks the database, so it cannot see the constraints
the parity suites assert, but it covers far more request paths than the 19 gated parity
files, it is where the 630 tests live, and no other workflow runs it.

### The 02 parity suites are real now

The 15 `02x` suites used to be unfalsifiable: `beforeAll` never seeded a tenant, they
authenticated with `Authorization: Bearer <token>` against an API that has read
`x-organization-id` since 02a, and several `it` blocks were bare comments that passed
vacuously. They had never run, because the CI job died before executing anything.

They have since been rewritten against the header-based tenant context and a live PostgreSQL
database, seeded per-test and torn down per-suite, so each one asserts against rows that
actually exist. That is what found the two `totalLineItems` defects and the `removeMember`
role defect in the table above: none of them were reachable from the mocked server suite,
which is the argument for keeping both rather than picking one.

`test:parity:all` is now **19 files / 279 tests in the gated set, plus `03-auth` failing by
design.** The `02x` count went from 16 directories described in earlier drafts of this file to
the 15 that exist on disk; earlier drafts also miscounted the failures twice before landing
here.

### The bundle budget is measured, not guessed

The 100 kB budget from the first CI pass was set against a 73.04 kB shell that imported
nothing from `@dms/ui`, so it left 27 kB of headroom for a library that did not exist. It was
recalibrated once the UI package landed, against brotli measurements of the real thing:

| Build | Brotli |
|---|---|
| Shell, no `@dms/ui` import | 73.04 kB |
| `Button` only, via the barrel | 89.49 kB |
| `Button` + `DataTable` + `DateRangePicker` (one report screen) | 128.23 kB |

**175 kB** is set from the 128.23 kB worst case with roughly 35% headroom. Past that, charts,
tables and the date range need `React.lazy` splitting rather than a bigger number — the
measurements above are how to tell the difference between the two.

Getting there needed `"sideEffects": false` on `@dms/ui`. Without it Rollup treats every
`export *` in the barrel as potentially effectful and pulls all of recharts in for a single
`Button`; with it, `Button`-only is 89.49 kB rather than 155.62 kB.

### Schema migrations

An initial migration now exists at `packages/db/prisma/migrations/0001_init/`, generated
from the authoritative `schema.prisma`, so both changes previously flagged as unapplied to
any live database are captured as a migration rather than living only in `schema.prisma`:

- `@@unique([organizationId, userId])` on `Member` → `member_organizationId_userId_key`
- `onDelete: Cascade` from `sales` / `purchases` / `returns` to their line tables

Verified against a live PostgreSQL 16 instance. Apply with
`pnpm --filter @dms/db exec prisma migrate deploy`.

**Before applying it to a database that already has rows**, dedupe `Member` — the
`@@unique([organizationId, userId])` index will fail to create if any user has two
membership rows in the same organization.

---

## For AI agents

If you are reading this to update it: **verify before you write.**

### Procedure

1. `git checkout main && git pull`
2. Check what actually exists — do not trust the `Status` column, including this file:
   ```bash
   rg -n "apiRouter.use" apps/server/src/routes/index.ts
   ls apps/web/src/pages 2>/dev/null || echo "no pages"
   find checkpoints -name "*.tsx" -not -path "*/node_modules/*"
   ```
3. Run the suite: `cd apps/server && ./node_modules/.bin/vitest run`
4. Update only the rows whose status actually changed
5. Update **Last updated** to today's date
6. Commit the doc change **separately** from implementation code, so the status file is never
   part of a feature diff

### Rules

- **Never mark Implemented from a `plan.md`.** Every checkpoint from 04 onward has a complete
  written plan. Plans are not code. Require: files exist on `main`, routes mounted, tests passing.
- **A passing test is not proof if the test is a stub.** Checkpoint 00's harness test is
  `expect(true).toBe(true)`. All of 06–12 are `{}`. Count real assertions before citing a
  green suite as evidence.
- **Record the PR number** when a checkpoint lands. If it has no PR, it is not done.
- **Preserve the "Defects found and fixed" tables.** They are the reason to trust this file.
  If a review pass finds new defects in already-merged code, add a row and note the PR that
  fixed it — do not overwrite history.
- **When you find a defect, fix it and note it here.** Checkpoint 2 is done, but that is
  where cross-tenant authorization bugs live; the pattern to check for is a service reading
  an ID from a request body and writing it straight to a foreign key.
- **Do not remove a row.** Move it to a "superseded" or "reverted" state with a reason. The
  history of what was built and undone is the point.
- If a checkpoint is partially done, split the row and say exactly which half is missing.
  "Partial" without specifics is worse than nothing.

### Update triggers

| Trigger | Action |
|---|---|
| A checkpoint PR merges | Flip status, record PR number, move a row into a merged table if one exists |
| Review finds a defect in merged code | Add to the defects table with the fixing PR |
| A checkpoint is reverted or replaced | Keep the row, change status, add reason |
| Scope of a checkpoint changes | Update the description, not just the status |