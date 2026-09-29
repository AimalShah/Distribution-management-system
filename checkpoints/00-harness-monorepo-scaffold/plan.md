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

### 6. `apps/server` — Express API

- `package.json` with Express, Cors, Zod, `@dms/db`, `@dms/shared`
- `src/index.ts` — Express app setup with CORS, JSON parsing, route mounting
- `src/routes/` — route files (to be populated in Checkpoint 2)
- `src/middleware/auth.ts` — auth middleware (to be implemented in Checkpoint 3)
- `src/harness/` — debug/introspection harness:
  - `src/harness/registry.ts` — service registry (Map<string, Function>)
  - `src/harness/router.ts` — Express router exposing `GET /__harness/:service` and `POST /__harness/:service/:method`
  - `src/harness/cli.ts` — CLI script that calls registered service functions and prints JSON

### 7. `apps/desktop` — Electron shell

- `package.json` with Electron, electron-builder
- `src/main.ts` — Electron main process, loads `apps/web` build output
- `src/preload.ts` — context bridge
- `electron-builder.yml` — packaging config

### 8. Config packages

- `packages/config-eslint/` — shared ESLint config
- `packages/config-typescript/` — shared tsconfig base

### 9. CI fitness functions

- `.github/workflows/fitness-functions.yml` — initial CI with bundle-size check (other fitness functions added as checkpoints complete)

## Verification

- `pnpm install` succeeds
- `pnpm turbo run build` builds all packages
- `pnpm --filter server run harness` starts the CLI and prints JSON for a registered service
- `pnpm --filter web run dev` starts Vite dev server
- `pnpm --filter server run dev` starts Express with harness endpoints at `/__harness/*`
