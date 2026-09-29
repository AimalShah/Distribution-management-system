# Checkpoint 0 — Harness + Monorepo Scaffold

## Source Review

**Status:** New work — no existing source to review.

This checkpoint establishes the Turborepo/pnpm monorepo structure and builds the debug/introspection harness before any porting starts.

### Current State

The existing repo is a single-package Next.js 15 app at the repo root. No monorepo configuration exists (`turbo.json`, `pnpm-workspace.yaml` absent). Dependencies are managed with npm (`package-lock.json` present).

### What Needs to Be Built

1. **Monorepo scaffold** — `pnpm-workspace.yaml`, `turbo.json`, root `package.json` with workspace scripts
2. **Empty app shells** — `apps/web` (Vite + React 19), `apps/server` (Express), `apps/desktop` (Electron)
3. **Shared packages** — `packages/ui`, `packages/db`, `packages/shared`, `packages/config-eslint`, `packages/config-typescript`
4. **Debug/introspection harness** — dev-only Express endpoint returning current state for any registered service, plus a CLI script that calls exported service functions directly and prints JSON

### Architecture Decisions (from DMS-monorepo-architecture-plan.md)

- Turborepo over Nx (small team, thin config layer, free remote caching)
- pnpm workspaces (strict dependency isolation)
- `packages/db` imported only by `apps/server` — never by web/desktop
- `packages/shared` holds Zod schemas for both Express validation and frontend API client typing
- `apps/desktop` wraps `apps/web` build output, talks to `apps/server` over HTTP
