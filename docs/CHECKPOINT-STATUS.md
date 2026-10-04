# Checkpoint Implementation Status

**Last updated:** 2026-10-01
**Repo:** `Distribution-management-system`
**Branch:** `main` @ `64e70d6`

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
| 02a–02o — Express API | **Implemented** (2j/2k mounted in `app.ts`) |
| 03 — Auth | **Partial** (shim only) |
| 04a–04j — React Web App | **Planned** |
| 05 — Electron Shell | **Partial** |
| 06 — RBAC Rebuild | **Planned** |
| 07–12 — Domain features | **Spec only** |

**The API layer is done. There is no UI.**

---

## 00 — Harness + Monorepo Scaffold · Implemented

Monorepo works: Turborepo + pnpm workspaces, `apps/{web,server,desktop}`,
`packages/{ui,db,shared,config-eslint,config-typescript}` all exist.

The harness is `packages/devtools` (CLI: `call`, `state`, `render`,
`screenshot`, `diff`) and the server exposes it through the dev-only debug
router at `apps/server/src/routes/__debug.ts` (`GET /__debug/state`,
`POST /__debug/call`). The parity test asserts both and checks them rather
than passing vacuously.

## 01 — Shared Packages · Implemented

`packages/shared` has `pagination.ts`, `inputs.ts`, and 15 schemas (auth, product, purchase,
sale, return, inventory, customer, supplier, organization, member, category, brand, report).

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

**618 tests pass, `tsc --noEmit` clean.**

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

## 03 — Auth · Partial

The stand-in middleware reads a `USER_HEADER` and `ORGANIZATION_HEADER`. `app.ts` refuses to
start in production with the shim enabled. Real auth is checkpoint 3 and is **not done**.

Every authorization check built so far depends on this shim being replaced with something
that makes `req.auth.userId` trustworthy.

## 04 — React Web App · Planned (0%)

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
| 04a | Dashboard | Planned |
| 04b | Product Pages | Planned |
| 04c | Purchase Pages | Planned |
| 04d | Sale Invoice Pages | Planned |
| 04e | Inventory Page | Planned |
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
# API tests — 628 pass
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
| `bundle-size` | Passes — `size-limit` in `apps/web`, configured by `apps/web/.size-limit.json` (100 kB budget; measured 73.04 kB). |
| `checkpoint-parity` | Passes — runs `pnpm run test:parity` (the parity gate) plus the server suite (`pnpm --filter @dms/server test`, 628 tests). |
| `table-pagination-check` | Passes, but still vacuously: `apps/web/src` has no `<table>` yet. It becomes meaningful with checkpoint 4. |

**What the parity job actually enforces is now declared, not implied.**
`checkpoints/parity-gate.ts` lists every checkpoint as `gated` or `pending`, each `pending`
with the reason it is not enforced, and `checkpoints/parity-gate.test.ts` fails if a
checkpoint gains a parity suite without a decision, or if a `gated` entry matches no files
on disk. Today only `00` is `gated` (16 tests). `pnpm run test:parity:all` runs the full
28-suite set for progress tracking; the `pending` suites fail there by design.

The server suite runs alongside it. The `checkpoints/**/parity.test.ts` specs were written
before implementation and are not the verification the job name implies — they need a live
database and leave `authToken` undefined. Their imports now point at the real app
(`apps/server/src/app`) rather than the non-existent `../src/app`, but it is the 628 server
tests that actually cover checkpoint behaviour.

The 22 `02x` failures that the gate exposed are **not regressions**. Those 16 suites are
unfinished stubs: `beforeAll` never seeds a tenant, they authenticate with
`Authorization: Bearer <token>` against an API that has read `x-organization-id` since 02a,
and several `it` blocks are bare comments that pass vacuously. They have never run, because
the job died before executing anything. They need rewriting against the header-based tenant
context, reconciled against the existing 628 server tests rather than duplicated.

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