# Deployment and operations

This guide covers the production deployment of the DMS web app and API on the
AM Enterprise domain. The database provider decision and connection model are
recorded in [ADR 0012](adr/0012-neon-serverless-postgres.md).

## 1. Configure the services

The API runs as a persistent Node.js service. The web app is a static Vite
build. Configure these values in the hosting provider's secret/environment
settings; do not commit production values to `.env` files.

| Variable | Configure | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | API and migration job | Neon pooled endpoint, including `sslmode=require`; used by application queries. |
| `DATABASE_URL_UNPOOLED` | API and migration job | Neon direct endpoint, including `sslmode=require`; Prisma uses it for migrations. |
| `BETTER_AUTH_SECRET` | API | Random secret of at least 32 characters. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | API | Public auth base URL, normally `https://am-enterprise.org`. |
| `DMS_ALLOWED_ORIGINS` | API | Comma-separated web origins, including `https://am-enterprise.org` and `https://www.am-enterprise.org` if both are served. |
| `TRUSTED_ORIGINS` | API | Better Auth trusted browser origins. Set the same production origins as `DMS_ALLOWED_ORIGINS`. |
| `REQUIRE_EMAIL_VERIFICATION` | API | Set to `true` in production. |
| `RESEND_API_KEY` | API | Resend API key for verification mail. |
| `EMAIL_FROM` | API | Sender address on the verified `am-enterprise.org` domain, for example `AM Enterprise <no-reply@am-enterprise.org>`. |
| `DMS_TRUST_PROXY` | API | Set to the actual number of trusted proxy hops (`true` means one). Leave unset when the API is directly exposed. |
| `PORT` | API host | Set this only if the host does not provide its listening port automatically. |
| `VITE_API_URL` | Web build | API base URL ending in `/api`; Vite bakes it into the bundle at build time. |
| `DMS_OWNER_PASSWORD` | One-time owner bootstrap | Strong, unique owner password. Never use `admin123`. |
| `DMS_OWNER_EMAIL` | One-time owner bootstrap | Production owner's email address. |
| `DMS_OWNER_NAME` | One-time owner bootstrap | Owner's display name. |
| `DMS_ORGANIZATION_NAME` | One-time owner bootstrap | Initial company name. |
| `DMS_ORGANIZATION_SLUG` | One-time owner bootstrap | Initial company slug. |

The bootstrap identity values are read by `pnpm db:seed:owner` and are optional
for local development. For production, use an organization specific to the
customer. Remove `DMS_OWNER_PASSWORD` from the host after bootstrap. Never set
`DMS_TRUSTED_PROXY_AUTH=true` unless a trusted gateway authenticates every
request and supplies the user, organization, and session headers itself. Do not
set development `DMS_AUTH_*` variables in production.

If the API host does not provide Chromium, configure `PUPPETEER_EXECUTABLE_PATH`
to point to its installed Chrome/Chromium binary; server-side PDFs use
Puppeteer.

## 2. Build and deploy

For a clean checkout:

```sh
pnpm install --frozen-lockfile
```

The `@dms/db` install hook generates the Prisma client. The database workspace
build also generates it, so Turbo builds have the client available even when
install hooks were disabled by a build environment.

Before deploying an application version that changes the Prisma schema, take a
Neon snapshot/branch, then apply the committed migrations using the direct URL:

```sh
pnpm db:migrate:deploy
pnpm build
```

Deploy the API service and static `apps/web/dist` output after the build passes.
The database schema declares `DATABASE_URL_UNPOOLED` as Prisma's `directUrl`, so
`migrate:deploy` uses the direct connection while the running application uses
the pooled URL. Do not run `prisma db push` in production; schema changes must
be represented by committed migrations.

### First owner setup

There is no production default password. To provision the initial owner, set the
one-time bootstrap values from the environment table, then run this command
against the intended production database:

```sh
DMS_ALLOW_DESTRUCTIVE=true pnpm db:seed:owner
```

The seed command refuses remote databases unless the explicit override is set,
prints the target host before proceeding, and refuses the known local password.
Review that host before continuing. The password is hashed and is not printed.
Once the command succeeds, remove `DMS_ALLOW_DESTRUCTIVE` and
`DMS_OWNER_PASSWORD` from the host, sign in using the configured owner email,
and confirm the company name and slug in Company Settings. Never run the general
`db:seed`, `db:seed:stress`, or `db:wipe` commands against production.

## 3. Verify a release

Check the public API health endpoint after the API starts:

```sh
curl --fail https://am-enterprise.org/api/health
```

A healthy response is HTTP 200 with `{"status":"ok","db":"ok"}`. A database
failure returns HTTP 503 with `db:"down"`; inspect the API's structured logs
and confirm both database URLs point at the intended Neon project.

Complete this smoke flow on the deployed environment with a designated test
account and reversible test data:

1. Sign in and switch to the intended company.
2. Create a product and a supplier.
3. Record a purchase and confirm stock increases.
4. Record a sale and confirm stock decreases and the server-issued invoice code is shown.
5. Record a payment and confirm the customer balance updates.
6. Download a customer statement PDF and test the WhatsApp share action.
7. Create a staff account, hand over its temporary password securely, and verify the first-login password change is required.
8. Deactivate and reactivate the staff account; verify the deactivated account cannot sign in.

Also confirm that verification email arrives from the configured sender. The
credential limiter allows 10 failed sign-in attempts per IP per 10 minutes;
the wider auth surface allows 300 requests per IP per 10 minutes. Both use an
in-memory store, so the current limits assume one API process. Behind a proxy,
`DMS_TRUST_PROXY` must match the real trusted hop count for those per-IP limits
to identify visitors correctly.

## 4. Backup and restore rehearsal

Before the first production migration, create a Neon baseline snapshot/branch
from the production database. Keep the provider's automatic recovery/PITR
available as an additional recovery option; it does not replace the rehearsal.

To rehearse a restore without touching production:

1. Create a scratch Neon branch from the baseline snapshot in the Neon console.
2. Obtain that branch's pooled and direct connection URLs.
3. Point a temporary API deployment or local operator environment at the scratch branch only.
4. Run `pnpm db:migrate:deploy` against its direct URL and start the API against its pooled URL.
5. Check `/api/health`, sign in with a test account, and verify representative products, customers, invoices, payments, and statement PDFs are present.
6. Record the snapshot/branch identifiers, restore time, migration result, and application checks in the operations log, then delete the scratch branch when the rehearsal is complete.

Never point the production service at a scratch restore while testing. Keep the
baseline identifier and rehearsal results with the deployment handover.

## 5. Staff onboarding and access recovery

An owner or administrator opens **Team & Permissions → Add staff account**,
sets the member's name, email, and role, and creates the account. The temporary
password is shown once; transfer it to the staff member through an approved
private channel. At first sign-in the app requires a new password before any
tenant data is available. Do not send temporary passwords in a group chat or
include them in a ticket.

Use the Team page to change a member's role or deactivate/reactivate the
account. Deactivation ends existing sessions and blocks sign-in while retaining
the membership history. Keep at least one active owner: the last owner cannot be
deactivated or removed. For an owner who cannot sign in, use the approved
account recovery procedure rather than changing the password directly in the
database.

## 6. Rollback

If the release fails its health or smoke checks:

1. Stop or route traffic away from the failing API/web release.
2. Redeploy the last known-good API and web artifacts.
3. Check health and repeat the sign-in and read-only smoke checks.
4. If the previous application cannot operate against the migrated schema, restore the pre-deploy Neon snapshot to a new recovery branch and follow the incident recovery plan before switching production traffic.

Do not use `migrate reset`, `db push`, or ad hoc SQL to roll production backward.
Migrations are forward history. Prefer a reviewed forward-fix migration when
the data remains valid; restore from the snapshot only when the deployment has
made the production data unusable and the recovery point is approved.
