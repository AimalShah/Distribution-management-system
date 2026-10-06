# Checkpoint Implementation Status

**Last updated:** 2026-10-07
**Repo:** `Distribution-management-system`
**Branch:** `main` @ `1e629bc`

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
| 02a–02o — Express API | **Implemented** — all 15 parity suites `gated`; routes mounted |
| 03 — Auth | **Implemented** — better-auth sessions + header trusted-proxy; `gated` |
| 04a–04j — React Web App | **Implemented** — 23 pages, all ten sub-suites `gated` |
| 05 — Electron Shell | **Implemented** — packaging, security contracts & build output `gated` |
| 06 — RBAC Rebuild | **Implemented** — Prisma roles/permissions, Express API `/api/roles`, web matrix UI, `gated` |
| 07–12 — Domain features | **Spec only** |
| 13 — Invenza UI Dashboard | **Implemented** — `gated` |
| 14 — Soft Delete & Restore | **Partial** — code + server tests on `main`; parity suite is a plan only |
| 15 — Payments & Invoice Lifecycle | **Partial** — code + server tests on `main`; parity suite is a plan only |
| 16 — Customer Ledger & WhatsApp Statements | **Partial** — code + server tests on `main`; parity suite is a plan only |
| 17 — App-wide Confirmation Dialogs | **Partial** — component + conversions on `main`; parity suite is a plan only |

**The API layer is done and the web UI is built**: `apps/web` has 23 pages wired to the
real API (dashboard, products, purchases, sales, returns, inventory, customers,
suppliers, reports, users, billing, permissions, profile, payments, customer ledger),
all gated individually as 04a–04j. Checkpoint 03 (better-auth sessions + fallback auth) is implemented and gated.

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

**685 tests pass, `tsc --noEmit` clean.**

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

## 04 — React Web App · Implemented (04a–04j gated individually)

`apps/web` is a React 19 + Vite + react-router-dom 7 + SWR + TanStack Table app with 21
pages under `apps/web/src/pages/`, all calling the real API through `lib/api.ts`. The
top-level `04-react-web-app` gate entry stays `pending` only because the ten sub-suites
are gated one at a time (see the comment in `checkpoints/parity-gate.ts`).

| ID | Checkpoint | Status |
|---|---|---|
| 04a | Dashboard | Implemented — `gated` |
| 04b | Product Pages | Implemented — `gated` |
| 04c | Purchase Pages | Implemented — `gated` |
| 04d | Sale Invoice Pages | Implemented — `gated` |
| 04e | Inventory Page | Implemented — `gated` |
| 04f | Returns Pages | Implemented — `gated` |
| 04g | Customer Page | Implemented — `gated` |
| 04h | Supplier Page | Implemented — `gated` |
| 04i | Reports Page | Implemented — `gated` |
| 04j | Settings Pages | Implemented — `gated` (Billing and Permissions pages are still placeholders inside) |

## 05 — Electron Shell · Implemented

`apps/desktop` wraps the web app in Electron with `contextIsolation: true`, `nodeIntegration: false`,
guarded IPC preload bridge, standard 1400x900 window, dev/prod load switches, CommonJS compiler
config (`dist/`), and multi-platform packaging (`electron-builder.yml`). Its parity suite is `gated`
and passes.

## 06 — RBAC Rebuild · Implemented

Replaced the placeholder `project`-only model with real resource/action statements across all 12 DMS resources
(`inventory`, `sales`, `purchases`, `returns`, `customers`, `suppliers`, `products`, `categories`, `brands`, `reports`, `settings`, `users`).
Prisma models `Role` and `RolePermission` added with `Member.roleId` relationship. Default system roles seeded:
`Admin` (full access), `Sales`, `Inventory Staff`, and `Manager`. Express API endpoints `/api/roles` support listing, creating,
updating, and deleting custom roles, with system role protection against deletion and rename. `PermissionPage.tsx`
provides a complete permission matrix comparison view and custom role editor dialog with action checklists.
Gated in `parity-gate.ts` and covered by `checkpoints/06-rbac-rebuild/parity.test.ts`.

## 07–12 — Domain features · Spec only

Plans exist. **Every acceptance test is an empty stub** — test names with `{}` bodies:

| ID | Checkpoint | Empty stubs |
|---|---|---|
| 07 | Batch/Lot Inventory + Expiry KPI | 7 |
| 08 | GST Fields + Sale Tax Invoice | 6 |
| 09 | Brand-Scoping on Sale/Purchase | 5 |
| 10 | Bulk Import, Wired for Real | 7 |
| 11 | Return Policy, Credit Terms, Customer GST | 6 |
| 12 | Client's Invoice Layout Swap-In | 6 |

## 13 — Invenza UI Theme & Dashboard · Implemented

Landed in `88d6001`. The whole chrome is Invenza-styled: `AppSidebar`, `Topbar`,
`invenza.css` design tokens, dashboard widgets fed by the real `GET /dashboard/stats`,
PDF invoice rendering (`services/sale-pdf.ts`, `utils/generateInvoicePdf.ts`), and a
PKR currency setting. Its parity suite is `gated`.

One fitness function regressed with it: three Invenza components render a raw
`<table>`, which `table-pagination-check` forbids — see the defects note in the CI
table below.

## 14–17 — Soft delete, payments, ledger, confirmations · Partial

Landed in `1e629bc`. The **code** is on `main` and covered by the mocked server suite
(685 tests) and the parity suites that already existed (02c/02e were rewritten for the
new delete semantics, 04b/04g/04h/04j for `ConfirmDialog`). The **dedicated parity
suites** for these four checkpoints are deliberately not written yet: `plan.md` +
`plan.lock` exist for each, and each plan carries the "Parity suite outline" that the
suite must assert once it is written. No `parity-gate.ts` entry exists for them, which
is correct — a `gated` entry with no suite on disk fails the gate by design.

| ID | Checkpoint | Code on `main` | Parity suite |
|---|---|---|---|
| 14 | Soft Delete & Restore | Yes — sale/return tombstones, stock reversal, restore, `deleted` list flag | Plan only (`checkpoints/14-soft-delete-restore/`) |
| 15 | Payments & Invoice Lifecycle | Yes — `Payment` entity, `/api/payments`, cancel/uncancel, corrections | Plan only (`checkpoints/15-payments-invoice-lifecycle/`) |
| 16 | Customer Ledger & WhatsApp | Yes — derived `GET /customers/:id/ledger`, `CustomerLedgerPage`, `wa.me` share | Plan only (`checkpoints/16-customer-ledger-whatsapp/`) |
| 17 | Confirmation Dialogs | Yes — `ConfirmDialog`, every destructive action behind it, zero `window.confirm` | Plan only (`checkpoints/17-confirmation-dialogs/`) |

Promoting each to **Implemented** requires: write the suite from its plan's outline,
gate it in `parity-gate.ts`, and record the PR — the rules at the bottom of this file
apply unchanged.

---

## Build and test

```bash
# API tests — 685 pass
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

Two of the three fitness-function jobs pass; `bundle-size` fails for reasons that
predate the 14–17 wave (measured below):

| Job | Status |
|---|---|
| `bundle-size` | **Currently fails on `main`**, and did before checkpoints 14–17 touched it: measured **1.28 MB** against the **260 kB** in `apps/web/.size-limit.json`. The failure is pre-existing (checkpoint 13's vendor chunks — jspdf/html2canvas/purify — all sit under the `dist/assets/*.{js,css}` glob); the 14–17 wave adds ~10 kB. Fixing it means `React.lazy` splitting, not a bigger number — see the note below. |
| `checkpoint-parity` | Passes — runs `pnpm run test:parity` against a real PostgreSQL (the parity gate) plus the server suite (`pnpm --filter @dms/server test`, 685 tests). |
| `table-pagination-check` | **Passes** — the three Invenza components from checkpoint 13 (`LowStockTable`, `InvoiceDetailModal`, `RecentSalesTable`) were converted to the shared `@dms/ui` `Table` in the 14–17 wave; no literal `<table` remains under `apps/web/src`. It had been failing only on `pull_request`, which is why a green `main` hid it. |

**What the parity job actually enforces is now declared, not implied.**
`checkpoints/parity-gate.ts` lists every checkpoint as `gated` or `pending`, each `pending`
with the reason it is not enforced, and `checkpoints/parity-gate.test.ts` fails if a
checkpoint gains a parity suite without a decision, or if a `gated` entry matches no files
on disk. `00`, `01` and `02` are now `gated`. `pnpm run test:parity` (the gated set CI
enforces) is **30 files / 349 tests, all passing**; `pnpm run test:parity:all` runs every
suite, and the only remaining failures there are the `03-auth` HTTP tests, which are meant to
fail against the header-trust shim until checkpoint 3 lands.

The server suite runs alongside it. It mocks the database, so it cannot see the constraints
the parity suites assert, but it covers far more request paths than the 19 gated parity
files, it is where the 685 tests live, and no other workflow runs it.

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

`test:parity:all` is now **30 files / 349 tests in the gated set, plus `03-auth` failing by
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

**The number in the repo today is neither 175 kB nor believed.** `apps/web/.size-limit.json`
now says **260 kB** against a glob of *every* built asset, and the measured total is
**1.28 MB** — so `bundle-size` fails, and has since checkpoint 13 landed the PDF stack.
Re-measured on `main` with and without the 14–17 changes: 1.28 MB before, 1.29 MB after,
so this wave is not what moved it. The three measurements above still say what to do:
split the charts, tables and PDF renderer behind `React.lazy` rather than raising the cap.

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