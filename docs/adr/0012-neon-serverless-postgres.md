# Neon Serverless Postgres for cloud database hosting

Neon Serverless Postgres is adopted as the managed PostgreSQL provider for cloud environments (staging and production). `packages/db` already defines dual endpoints in `prisma/schema.prisma` (`url` and `directUrl`), allowing runtime application queries to route through Neon's connection pooler while schema migrations route through the unpooled direct compute endpoint.

Node.js and Express in `apps/server` connect using the standard Prisma TCP engine over Postgres wire protocol. Edge WebSocket drivers (`@prisma/adapter-neon` and `@neondatabase/serverless`) are not needed because the backend runs in a persistent Node.js environment rather than serverless edge runtimes.

Local development and local CI parity runs continue to run against local PostgreSQL instances (`dms_test`) via `.env.example` to ensure tests run offline without remote network dependencies.

**Considered options:**
- `@prisma/adapter-neon` with `@neondatabase/serverless`: rejected because the backend is an Express server running in Node.js; TCP pooling via Neon's PgBouncer endpoint provides better performance and avoids unnecessary WebSocket abstraction.
- Cloud-only Neon workflow (retiring local PostgreSQL): rejected because local parity suites (250+ assertions in `checkpoints/`) require fast, offline-capable database instances during local development and CI runs.
- Automated per-PR ephemeral branching: deferred to a future phase once cloud deployment pipelines are established.

**Consequences:**
- Cloud deployments configure `DATABASE_URL` pointing to the pooled Neon endpoint (`*-pooler.neon.tech?sslmode=require`) and `DATABASE_URL_UNPOOLED` pointing to the direct endpoint (`*.neon.tech?sslmode=require`).
- Production and staging schema migrations run non-interactively using `prisma migrate deploy` against `DATABASE_URL_UNPOOLED`.
- Local development workflows remain completely unchanged.

**Status:** accepted
