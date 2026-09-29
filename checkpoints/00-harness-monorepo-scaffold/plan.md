# Checkpoint 0 — Harness + Monorepo Scaffold: Plan

## Goal

Set up the Turborepo/pnpm monorepo structure with empty app shells and the debug/introspace harness.

## Steps

### 1. Root configuration files

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**`turbo.json`:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] }
  }
}
```

**Root `package.json`:**
```json
{
  "name": "dms",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "db:generate": "pnpm --filter db run generate",
    "db:migrate": "pnpm --filter db run migrate",
    "db:seed": "pnpm --filter db run seed",
    "harness": "pnpm --filter server run harness"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5"
  }
}
```

### 2. `packages/db` — Prisma package

- Copy `prisma/schema.prisma` verbatim from repo root
- `package.json` with `@prisma/client` dependency, `prisma` devDependency
- Scripts: `generate` (prisma generate), `migrate` (prisma migrate dev), `seed` (tsx prisma/seed.ts)
- Export a singleton PrismaClient from `src/index.ts`

### 3. `packages/shared` — Shared types and Zod schemas

- `package.json` with `zod` dependency
- `src/index.ts` re-exporting all schemas
- `src/pagination.ts` — `paginationQuerySchema` and `paginatedResponseSchema` (from architecture plan §5)
- `src/schemas/` — Zod schemas for each entity (to be populated in Checkpoint 1)

### 4. `packages/ui` — shadcn/ui components

- `package.json` with React, Radix UI, Tailwind, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`
- `components.json` for shadcn CLI
- `src/index.ts` re-exporting all components
- `src/components/` — shadcn components (to be populated in Checkpoint 1)
- `src/components/data-table.tsx` — shared DataTable wrapper (from architecture plan §5)

### 5. `apps/web` — Vite + React 19 SPA

- `package.json` with React 19, Vite, React Router, TanStack Table, SWR, Axios, Zod
- `vite.config.ts` with proxy to `apps/server`
- `index.html`
- `src/main.tsx`, `src/App.tsx` (router setup)
- `src/lib/api.ts` — API client using Axios with base URL from env

### 6. `packages/devtools` — Debug/introspection harness

- `package.json` with `tsx`, `jsdom`, `@testing-library/react`, `playwright`, `pixelmatch`, `pngjs`
- `src/cli.ts` — entry point with subcommands: `call`, `state`, `render`, `screenshot`, `diff`
- `src/service-call.ts` — dynamic-imports service module and calls named export directly
- `src/debug-state-client.ts` — fetches `GET /__debug/state` over HTTP
- `src/render-headless.ts` — RTL render with JSDOM for client components
- `src/use-debug-state.ts` — dev-only hook that exposes state on `window.__DEBUG_STATE__`
- `src/fetch-html.ts` — fetches rendered HTML over HTTP (for Next.js Server Components)
- `src/screenshot.ts` — Playwright screenshot capture
- `src/diff.ts` — DOM + screenshot diff against checkpoint `before/` captures

### 7. `apps/server` — Express API

- `package.json` with Express, Cors, Zod, `@dms/db`, `@dms/shared`
- `src/index.ts` — Express app setup with CORS, JSON parsing, route mounting
- `src/routes/` — route files (to be populated in Checkpoint 2)
- `src/routes/__debug.ts` — dev-only debug router:
  - `GET /__debug/state` — returns recent query log + query count
  - `POST /__debug/call` — calls a service function by name over HTTP
- `src/middleware/auth.ts` — auth middleware (to be implemented in Checkpoint 3)

### 8. `packages/db` — Prisma client with query tracking

- `src/debug-log.ts` — in-memory query log (model, action, ms, timestamp)
- `src/client.ts` — PrismaClient singleton with `$use` middleware that calls `trackQuery` in non-production

### 9. `apps/desktop` — Electron shell

- `package.json` with Electron, electron-builder
- `src/main.ts` — Electron main process, loads `apps/web` build output
- `src/preload.ts` — context bridge
- `electron-builder.yml` — packaging config

### 10. Config packages

- `packages/config-eslint/` — shared ESLint config
- `packages/config-typescript/` — shared tsconfig base

### 11. CI fitness functions

- `.github/workflows/fitness-functions.yml` — initial CI with bundle-size check (other fitness functions added as checkpoints complete)

## Verification

- `pnpm install` succeeds
- `pnpm turbo run build` builds all packages
- `pnpm debug call product.getProducts '{"page":1,"pageSize":20}'` prints JSON result
- `pnpm debug state` returns query log from running server
- `pnpm debug render --mode=fetch http://localhost:3000/product out.json` captures HTML
- `pnpm debug screenshot http://localhost:5173/products out.png` captures screenshot
- `pnpm debug diff 04-products-page` exits 0 when parity passes
- `pnpm --filter web run dev` starts Vite dev server
- `pnpm --filter server run dev` starts Express with debug endpoints at `/__debug/*`
