# TODO.md — DMS Launch Plan (2 days)

Created Oct 24 2026 after the Phase 1 audit. Sources: audit findings in this repo (all `[confirmed from code]` unless marked *[assumption]*).

Decisions locked with the owner:
- Defer `Float → Decimal` migration; make the server recompute money server-side instead.
- Staff onboarding = owner sets temp password + forced change on first login (invite-by-email is P2).
- Electron desktop app is out of scope for this launch.
- Production domain: `am-enterprise.org` (SPA + email from); API host set at deploy.

---

## P0 — Blockers (security holes, data-loss risk, the two known issues)

### [x] P0-1 · Kill the legacy auth backdoor
- **Why:** `admin/admin123` works in production with no env set; the legacy bearer fallback manufactures a session for **the first owner of the first organization in the DB** using a forgeable HMAC token with the hardcoded default secret `"dms-local-dev-secret"`. That is a full cross-tenant takeover.
- **Files:** `apps/server/src/services/auth.ts:10-12,34-40,71` (defaults + signing key), `apps/server/src/app.ts:76-78` (unconditional mount), `apps/server/src/middleware/session.ts:22-57` (dev-session impersonation of `findFirst(isOwner)`), `apps/server/src/config/env.ts:64-76` (`assertAuthIsSafe` must also reject a weak/absent `DMS_AUTH_SECRET`).
- **Est:** 1.5 h
- **Done when:** ✅ **Done — removed entirely** (owner choice: Better-Auth is the only sign-in surface). `services/auth.ts` + `routes/auth.ts` + `routes/auth.test.ts` deleted; `app.ts` no longer mounts the fallback router; `middleware/session.ts` answers 401 when there is no Better-Auth session (no bearer fallback, no first-owner impersonation); `DMS_AUTH_USERNAME/PASSWORD/NAME/SECRET` gone from code and `.env.example` (nothing signs with them, so the weak-secret startup check became moot); auth diagrams updated. Web login verified to use `authClient.signIn.email` only. 758/758 server tests pass (the deleted test file covered only the removed endpoints); typecheck clean.

### [x] P0-2 · Remove hardcoded/seeded credentials
- **Why:** the login page displays working seeded credentials `owner@test.com/admin123`; seeds default to `admin123` and print the password to stdout; anyone copying them gets known prod credentials.
- **Files:** `apps/web/src/lib/auth.tsx:38-41` (delete `DEFAULT_CREDENTIALS` + the login-page hint), `packages/db/prisma/seed.ts:115`, `packages/db/prisma/seed-owner.ts:78,95` (refuse the default password when targeting a non-local DB; never log it).
- **Est:** 1 h
- **Done when:** ✅ **Done.** `DEFAULT_CREDENTIALS` deleted (the login-page panel was already commented out in working-tree code); new `packages/db/prisma/owner-password.ts` — seeds require `DMS_OWNER_PASSWORD` for any non-localhost DB (abort with a clear error), explicitly refuse `DMS_OWNER_PASSWORD=admin123` everywhere, and keep the known literal only for localhost dev; env-supplied passwords are never echoed (masked as "(set from DMS_OWNER_PASSWORD — not shown)"); `scripts/screenshot.mjs` repointed to the seeded local-dev owner so dev tooling survives the change. `admin123` survives only in: screenshot.mjs (localhost-only tooling, labelled) and the localhost fallback in `owner-password.ts`. db + web typecheck clean, 77/77 web tests pass.

### [x] P0-3 · Rate-limit auth endpoints
- **Why:** `POST /api/auth/login` (legacy route) was an unlimited brute-force oracle; better-auth's own limiter is prod-only and generous (100 req/10 s/IP, memory-based).
- **Files:** `apps/server/src/app.ts` (add `express-rate-limit` middleware), `apps/server/package.json` (new dep), focused limiter on the legacy login route + a looser global one on `/api/auth/*`.
- **Est:** 45 min
- **Done when:** ✅ **Done.** New `apps/server/src/middleware/rate-limit.ts`: `credentialEntryLimiter` (10 **failed** sign-in/sign-up attempts per IP per 15 min; successes never burn the budget) + `authSurfaceLimiter` (300 req/10 min across all `/api/auth/*`), both answering the standard `{ error, code: "RATE_LIMITED" }` envelope so the web `toFailure` seam decodes them. Mounted in `app.ts` ahead of better-auth. Added `DMS_TRUST_PROXY` (`config/env.ts:44-66` + `.env.example`) so per-IP attribution is correct behind TLS-terminating proxies; memory store documented as single-node. New `rate-limit.test.ts`: 11th failure 429s, successes don't count, addresses isolated. Typecheck clean; 762/762 server tests pass.

### [x] P0-4 · Instant updates after every mutation (known issue #1)
- **Why:** the SWR config (`apps/web/src/main.tsx:12-20`) sets `revalidateIfStale:false` + a 120 s dedupe; mutating forms call **no `mutate()` at all** (`SaleInvoiceForm.tsx:273,249,312`, `PurchaseForm.tsx:188,209`, `ReturnForm.tsx:216`), and list pages revalidate only their own key — so stock, customer ledger, dashboard and sibling-key lists stay stale until reload; no polling/SSE exists, so multi-user screens never converge.
- **Files:** `apps/web/src/main.tsx`, new `apps/web/src/lib/mutation.ts` (helper + invalidation registry), update ~15 call-sites in `apps/web/src/components/*` and `apps/web/src/pages/*`, org switch via `OnboardingPage.tsx:117-153` (add the global mutate that `CompanySwitcher` already has), server `apps/server/src/app.ts`.
- **Est:** 6 h
- **Done when:** ✅ **Done (both halves; `Cache-Control: no-store` landed in `374ea09`).** · `main.tsx`: `revalidateIfStale:false` dropped and the 120 s dedupe removed → cached data refetches on mount. · New `lib/mutation.ts`: `invalidateDomains(primary)` — a domain→matcher registry plus per-domain cross-screen wiring (`ALONGSIDE`: sale → sales + payments + customers + inventory + dashboard + reports; payment/purchase/return analogues) walking the whole SWR cache and revalidating every sibling key; `invalidateEverything()` for company switches. · 23 page/component call-sites rewired (sale create/edit/override/delete/restore/cancel/uncancel/status, purchase create/edit/delete, return create/delete/restore, both payment flows, product/customer/supplier create/edit/delete, inventory adjust/add/bulk-import, members, roles). · Onboarding org create/switch, CreateCompanyDialog, CompanySettingsPage switch (**`window.location.reload()` removed**) and settings save now call `invalidateEverything()`. · Server: `Cache-Control: no-store` on every authenticated API mount. · PUT paths recompute stored figures from the stored line terms when the header terms change (`374ea09`, review follow-up; 5 regression tests). Unit test `lib/mutation.test.ts` pins the matcher contract (5 cases) — total web suite 17 files / 82 tests green; typecheck clean. · `scripts/qa/run.mjs` re-verifies the whole contract against the running app (sell → sale list + inventory + payments without a reload).

### [ ] P0-5 · User management: add staff, roles, deactivate (known issue #2)
- **Why:** an owner cannot create staff users at all — "add member" only offers `available-users` which is empty on a fresh tenant; no deactivate exists (`User.banned` columns are unmapped); custom-role assignment has no UI.
- **Files:** new route(s) in `apps/server/src/routes/member.ts` (or a new `user-provisioning` service) — create user (`admin.createUser` via better-auth admin plugin *[assumption: usable with `DMS_ADMIN_USER_IDS`/owner bootstrap]* or direct Prisma + `hashPassword`), set temp password, `revoke` sessions on deactivate; `packages/db/prisma/schema.prisma` only needs the unused `banned/banReason` columns; shared schemas in `packages/shared/src/schemas/`; UI in `apps/web/src/pages/UsersPage.tsx` + `apps/web/src/components/settings/MemberDialog.tsx` (add-staff form with email/name/temp password/role select, deactivate/reactivate action); perms already gated by `requireElevatedMember` — extend to custom roles later (P2).
- **Est:** 8 h (5 h server + 2 h UI + 1 h tests)
- **Done when:** owner/admin can (a) create a staff member with email + temp password, (b) the staff's first login forces a password change, (c) reassign role, (d) deactivate/reactivate, (e) deactivated members are rejected server-side on every `/api` route; all enforced on the server, not just hidden in the UI; server-side tests for each action.

### [x] P0-6 · Server recomputes all money figures
- **Why:** create/update sale paths honor client-supplied `taxAmount/discount/line prices` (`packages/shared/src/sale-money.ts:164-172,117`; `packages/shared/src/schemas/sale.ts:36-40,14-15`; `apps/server/src/services/sale.ts:186-194`); hostile/buggy clients can bank any GST split. Purchase header figures likewise (`services/purchase.ts:275-283`).
- **Files:** `apps/server/src/services/sale.ts` (derive breakdown from DB product rates only; strip client fields on create and reject them on update), `services/purchase.ts` (same for header tax/discount), `packages/shared/src/schemas/sale.ts` (remove the override fields from the create/update schemas), keep client-side preview as display-only.
- **Est:** 3 h
- **Done when:** ✅ **Done.** Terms in, figures derived: `packages/shared/src/schemas/sale.ts` strips `taxAmount/cgstAmount/sgstAmount/igstAmount` (header) and the per-line CGST/SGST/IGST rate+amount fields from the create/update contracts — the caller keeps only trade terms (line prices, the per-line `taxPercent` statement, header `discount`); `services/sale.ts` computes the breakdown exclusively from those terms plus the DB product rows' own rates. Same treatment for purchases: header `taxAmount` removed from `PurchaseFormSchema` and `createPurchase` stores `linesTax()` derived from the lines' rates. The schema change roots out both paths at once (zod drops unknown keys before `updateSale`/`updatePurchase` ever see them). UI aligned so preview and stored figures cannot diverge: the "Invoice Tax (Override)" and "Order Tax" inputs are now derived display-only boxes showing the server's figure. The three legacy tests that asserted banking client figures were flipped into regression tests that send forged `taxAmount` and assert the stored total/tax equal the derived ones (sale create + PUT, purchase create). shared/server/web typechecks clean; 762/762 server + 82/82 web tests pass. *[Interpretation kept: `taxPercent` per line and `discount` remain trusted operator terms — they are trade decisions like the price, carried under the caller's user id; the fraud ceiling this closes is forging figures inconsistent with the stated terms.]* · **Review follow-up (`374ea09`):** the update paths re-derive too — a PUT changing `discount` (sale/purchase) or `isInterState` (sale) recomputes the stored figures from the invoice's stored line terms through the same breakdown create uses, refusing negative totals and rewriting per-line splits in one transaction when the inter-state claim flips (5 regression tests).

### [x] P0-7 · Guard destructive scripts against production DBs
- **Why:** `pnpm db:wipe` delete-many's everything against whatever `DATABASE_URL` points at (`packages/db/prisma/wipe.ts:48-63`); `seed:stress` appends ~300k rows via `$executeRawUnsafe`; `seed:owner` plants `owner@test.com/admin123` and prints it.
- **Files:** `packages/db/prisma/{wipe,seed,seed-stress,seed-owner}.ts` (shared guard: refuse non-localhost/non-dev host unless `DMS_ALLOW_DESTRUCTIVE=true`).
- **Est:** 45 min
- **Done when:** ✅ **Done.** New `packages/db/prisma/db-target.ts`: `assertLocalDatabase(scriptName)` — throws naming the target host unless `DATABASE_URL` resolves to localhost/127.0.0.1/::1 (an unparseable URL is treated as hostile); `DMS_ALLOW_DESTRUCTIVE=true` overrides but always prints the host it is about to act on. Wired into the entry points of `wipe.ts`, `seed.ts` (both modes), `seed-owner.ts`, `seed-stress.ts`; override documented in `.env.example`. Owner-password targeting was already handled by P0-2's `owner-password.ts`. Verified live via tsx: a Neon host throws with the host in the error, localhost passes, the override warns and proceeds. `@dms/db` typecheck clean.

### [x] P0-8 · Production security headers + email/domain wiring
- **Why:** no helmet/CSP/HSTS anywhere; `EMAIL_FROM` defaults to `onboarding@resend.dev`; `am-enterprise.org` appears nowhere in the repo; `.env.example` ships `REQUIRE_EMAIL_VERIFICATION="false"`.
- **Files:** `apps/server/src/app.ts` (helmet with CSP + HSTS), `apps/server/src/auth/email.ts:17` (default `AM-Enterprise <no-reply@am-enterprise.org>`), `apps/server/src/config/env.ts:15-17` (add `https://am-enterprise.org` to production default origins), root `.env.example` (flip verification default to `"true"` with a "don't disable in prod" comment; add missing vars `PORT`, `DMS_HOST`, `DMS_ALLOWED_ORIGINS`, `EMAIL_FROM`, `PUPPETEER_EXECUTABLE_PATH`, `VITE_API_URL`).
- **Est:** 1.5 h
- **Done when:** ✅ **Done.** `helmet()` mounted first in `app.ts` (CSP defaults fine — verified no template ships inline scripts, only inline styles); `EMAIL_FROM` default now `AM-Enterprise <no-reply@am-enterprise.org>`; `https://am-enterprise.org` + www added to production default origins; `.env.example` now documents `DMS_ALLOWED_ORIGINS`, `PORT`, `DMS_HOST`, `EMAIL_FROM`, `PUPPETEER_EXECUTABLE_PATH`, `VITE_API_URL`, and flips `REQUIRE_EMAIL_VERIFICATION` to `"true"` with an explicit don't-disable comment. Typecheck clean; 762/762 server tests pass. **Operator action for go-live:** verify the `am-enterprise.org` sending domain in Resend (config still no-ops gracefully without `RESEND_API_KEY`).

---

## P1 — Must have before handover

### [ ] P1-1 · Error states on every list page
- **Why:** sales/purchases/returns/customers/payments lists destructure SWR without `error` — a failed GET renders as "no records", indistinguishable from empty data.
- **Files:** `apps/web/src/pages/{SaleInvoiceList,PurchaseList,ReturnList,CustomerList,PaymentsPage,ProductList}.tsx` (+ reports tabs missing it).
- **Est:** 2 h. **Done when:** a forced 500 shows a retry-able error panel on each page instead of an empty table.

### [ ] P1-2 · Global error boundary + 401 handling
- **Why:** a render crash = white screen (no ErrorBoundary in apps/web); an expired session shows silent empty pages (no 401 interceptor in `apps/web/src/lib/api.ts:16-30`).
- **Files:** new `apps/web/src/components/ErrorBoundary.tsx` wired in `App.tsx`; response interceptor in `lib/api.ts` (401 → sign-in redirect + toast).
- **Est:** 1.5 h. **Done when:** a thrown render error shows a friendly 500 page with "back to dashboard"; expired sessions redirect to login.

### [ ] P1-3 · CI: lint + typecheck jobs on push
- **Why:** the only CI (`.github/workflows/fitness-functions.yml`) handles build-size/parity on PRs; no lint/typecheck, nothing on push to main.
- **Files:** `.github/workflows/dms-ci.yml` (new: pnpm lint, typecheck, unit tests on push+PR).
- **Est:** 1 h. **Done when:** the CI job runs lint+typecheck and fails on regression (only after P1-4 makes lint pass).

### [ ] P1-4 · Lint gate green by a decided policy
- **Why:** `pnpm lint` exits 1 with 618 anti-slop errors + 48 warnings; CI lint is impossible until it passes. All 618 in 2 days is unrealistic.
- **Files:** `oxlint.config.mts`, widespread-but-autofixable whitespace rules via `oxlint --fix`, real fixes for unused vars (`SaleInvoiceList.tsx:337`, `ProductList.tsx:7`, `cache.ts:82`, `PermissionPage` imports), remove dead `jspdf` dep from `apps/web/package.json` (0 usages, inflates the bundle).
- **Est:** 2.5 h. **Done when:** `pnpm lint` exits 0; any suppression is a documented config decision, not scattered ignores.

### [ ] P1-5 · Health check that touches the DB + trust proxy + minimal logging
- **Why:** `/api/health` is DB-blind (`app.ts:87-89`); no `trust proxy` behind TLS-terminating edges; logs are raw console (unstructured, unredacted).
- **Files:** `apps/server/src/app.ts` (`trust proxy` + health route with a 1-line DB probe), add `pino` minimal request+error logging in `apps/server/src/http/error-handler.ts:50-51` and bootstrap.
- **Est:** 1.5 h. **Done when:** `/api/health` reports DB status with `{db:"ok"|"down"}`; error logs are JSON with request id, no secrets.

### [ ] P1-6 · One money/currency formatter everywhere
- **Why:** web shows `Rs 1,500` (`apps/web/src/lib/format.ts`), PDF templates print `Rs 1500.00` with no separators and 4 duplicated local formatters (`sale-invoice-template.ts:133,275-304`, `credit-note-template.ts:58`, `payment-receipt-template.ts:41`, `purchase-order-template.ts:47`, `customer-statement-template.ts:40`).
- **Files:** move the formatter to `packages/shared` (or one template helper) and use it from all templates.
- **Est:** 2 h. **Done when:** the same amount string appears on screen, invoice PDF and statement PDF.

### [ ] P1-7 · Deterministic invoice numbering per organization
- **Why:** `saleCode` is client-supplied with a **global** `@unique` (`schema.prisma:353`) → cross-tenant code collisions 409 the wrong party; no server sequence exists.
- **Files:** `schema.prisma` migration (`@@unique([organizationId, saleCode])` + equivalent for purchase/return/payment codes), `services/sale.ts` (server-side per-org sequence, ignore client codes).
- **Est:** 3 h. **Done when:** duplicated client codes are accepted as server-issued per-tenant sequences; cross-org duplicate codes no longer collide.

### [ ] P1-8 · Prisma generate on install + DB-aware deploy steps
- **Why:** the generated client is gitignored with no postinstall step — a deploy that forgets `pnpm db:generate` breaks at build.
- **Files:** `packages/db/package.json` (postinstall or prebuild generate), deployment doc.
- **Est:** 20 min. **Done when:** a fresh clone + `pnpm install` builds without manual generate.

### [ ] P1-9 · Ops doc + handover (DEPLOYMENT.md)
- **Why:** no deployment/ops/handover doc exists; envs, Neon pooled/unpooled, migrations, backups (Neon PITR), rate-limit behaviour are only in code comments.
- **Files:** new `docs/DEPLOYMENT.md`: env inventory with owners, Neon pooler notes (ADR 0012), migrate:deploy runbook, backup/restore test steps, staff-onboarding runbook for the client, rollback plan.
- **Est:** 2 h. **Done when:** a new operator can deploy and add staff without reading source code.

---

## P2 — Nice to have after launch

### [ ] P2-1 · `Decimal(12,2)` money migration (whole schema, integer-paise math)
### [ ] P2-2 · Multi-user realtime (SSE/WebSocket) driving the same mutation invalidation registry
### [ ] P2-3 · Invite-by-email staff flow (Invitation table + better-auth endpoints already exist, unused)
### [ ] P2-4 · Audit trail table (who changed what: products, settings, invoices) beyond stock logs
### [ ] P2-5 · Real data export (products/customers/sales/ledger CSV) — today only dashboard + inventory-template CSV
### [ ] P2-6 · Self-service forgot-password flow (no `sendResetPassword` wired today)
### [ ] P2-7 · Parity tests for checkpoints 14–17 + RBAC-UI test; Playwright E2E for sale→payment→statement flow
### [ ] P2-8 · Bundle diet (728 kB index / 393 kB AreaChart → manualChunks + lazy charts; CI budget 260 kB red)
### [ ] P2-9 · Urdu/i18n backbone (nothing exists today)
### [ ] P2-10 · Mobile-stacked layout for line-item editing tables
### [ ] P2-11 · Custom roles extend member-management permissions (unify `requireElevatedMember` legacy-string guards with the RBAC engine, `app.ts:106-118` vs `routes/index.ts:82`)
### [ ] P2-12 · Electron auto-update packaging (desktop launch deferred)

---

## 2-day schedule

### Day 1 — Security morning, instant updates afternoon
| Slot | Work |
|---|---|
| **Morning** | P0-1 backdoor kill (verify web login unaffected) → P0-2 credentials cleanup → P0-3 rate limiting → P0-8 helmet+email+origins. Gate: typecheck · lint (pre-P1-4 known red: targeted fixes only) · smoke login via better-auth. |
| **Afternoon** | P0-4 instant updates: SWR config flip (15 min) → `mutation.ts` helper + registry (1.5 h) → rewire the ~15 call-sites (2 h) → OnboardingPage org-switch mutate + `no-store` header (45 min) → manual smoke: sale create/delete → stock/ledger/dashboard update; test with 2 browsers as users A/B. |
| **Evening** | P0-6 server money recompute (3 h) → P0-7 script guards (45 min) → full `typecheck/lint/test/build`, one commit per item, tick boxes. |

### Day 2 — User management, polish, handover
| Slot | Work |
|---|---|
| **Morning** | P0-5 server: provision-user service (bcrypt temp password, forced-change flag), routes + permission checks, `banned` enforcement in the session middleware, deactivate → session revocation. Server tests for the 5 flows. |
| **Afternoon** | P0-5 UI: add-staff dialog (temp password shown once), role select, deactivate/reactivate, forced-change onboarding screen for new staff. Then P1-1 error states (1 h) + P1-2 error boundary/401 (1 h). |
| **Evening** | P1-4 lint policy + autofix → P1-3 CI file → P1-5 health/trust-proxy/pino → P1-8 generate on install → P1-6 shared money formatter → P1-9 DEPLOYMENT.md + handover doc → final full gates (`pnpm lint/typecheck/test/build`) → P1-7 numbering if time remains, else P2. |

*Anything that slips loses the least-Dangerous item last: P1-7 numbering can spill to P2.*

---

## Go-live checklist (handover gate)

- [ ] Env vars set on the prod host: `DATABASE_URL` (pooled, `sslmode=require`) + `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET` (32+), `BETTER_AUTH_URL=https://am-enterprise.org`, `DMS_ALLOWED_ORIGINS` (incl. am-enterprise.org), `REQUIRE_EMAIL_VERIFICATION=true`, `RESEND_API_KEY`, `EMAIL_FROM` (on `@am-enterprise.org`, domain verified in Resend), `DMS_OWNER_PASSWORD` (non-default), `VITE_API_URL` baked into web build, no `DMS_AUTH_*` dev vars.
- [ ] `pnpm db:migrate:deploy` clean against production (unpooled URL).
- [ ] Owner account created with a **non-default** password; `db:seed:owner` never run against prod, or run once with the env var set.
- [ ] Legacy login rejected; rate limiter verified with 6 bad attempts.
- [ ] Backup taken (Neon baseline snapshot) and restore-into-a-scratch-branch tested once.
- [ ] Smoke test passed end-to-end: login → company switch → product → purchase (stock in) → sale (stock out, code issued) → payment (balance) → statement PDF + WhatsApp share → staff account created, deactivated, re-activated.
- [ ] `/api/health` returns 200 with `db:"ok"` from the public domain over HTTPS.
- [ ] `DEPLOYMENT.md` + handover doc delivered (env list, runbooks, staff onboarding, backup/restore, rollback).
- [ ] Web app hosted at `https://am-enterprise.org` (SPA) with API URL configured; service worker-free, out of P2 scope.
