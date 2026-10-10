# DMS — UML Diagrams (Backend + Web UI)

One Mermaid source file per diagram. Reverse-engineered from `apps/server`,
`apps/web`, `packages/shared`, `packages/ui`, and
`packages/db/prisma/schema.prisma`.

Mermaid cannot hold several diagrams in a single `.mmd`, so each diagram is its
own file. Render any of them:

```bash
npx -y @mermaid-js/mermaid-cli -i docs/diagrams/07-service-layer.mmd -o service-layer.svg
```

Every file here parses with `mermaid.parse` and renders with `mermaid-cli`. A
pre-rendered `.svg` sits next to each `.mmd` (same base name).

## Backend diagrams

| # | Source (`.mmd`) | Rendered (`.svg`) | Type | Contents |
|---|---|---|---|---|
| 1 | [`01-system-context`](01-system-context.mmd) | [`svg`](01-system-context.svg) | flowchart | Web/Electron clients, Express server, shared/db packages, Postgres, Resend, Puppeteer |
| 2 | [`02-bootstrap-middleware-pipeline`](02-bootstrap-middleware-pipeline.mmd) | [`svg`](02-bootstrap-middleware-pipeline.svg) | flowchart | `createApp` mount order and `authMode` branch |
| 3 | [`03-http-layer-errors`](03-http-layer-errors.mmd) | [`svg`](03-http-layer-errors.svg) | classDiagram | `HttpError`, `asyncHandler`, error/prisma/zod translation |
| 4 | [`04-auth-session-rbac`](04-auth-session-rbac.mmd) | [`svg`](04-auth-session-rbac.svg) | classDiagram | `AuthMode`, auth-context, session, RBAC middleware, better-auth, token auth |
| 5 | [`05-session-vs-trusted-proxy`](05-session-vs-trusted-proxy.mmd) | [`svg`](05-session-vs-trusted-proxy.svg) | sequenceDiagram | Session resolution and membership re-check |
| 6 | [`06-api-router-surface`](06-api-router-surface.mmd) | [`svg`](06-api-router-surface.svg) | classDiagram | All 17 routers with every endpoint as notes |
| 7 | [`07-service-layer`](07-service-layer.mmd) | [`svg`](07-service-layer.svg) | classDiagram | Every service module with full function signatures |
| 8 | [`08-stock-movement-flow`](08-stock-movement-flow.mmd) | [`svg`](08-stock-movement-flow.svg) | flowchart | `applyStockMovement` guarded-write + batch consequences |
| 9 | [`09-reports-layer`](09-reports-layer.mmd) | [`svg`](09-reports-layer.svg) | classDiagram | Inventory / purchase / sales report functions |
| 10 | [`10-shared-contracts`](10-shared-contracts.mmd) | [`svg`](10-shared-contracts.svg) | classDiagram | Money, SKU, permissions, all Zod schemas |
| 11 | [`11-prisma-domain-class`](11-prisma-domain-class.mmd) | [`svg`](11-prisma-domain-class.svg) | classDiagram | All 25 models with every field, enums, relations |
| 12 | [`12-prisma-domain-er`](12-prisma-domain-er.mmd) | [`svg`](12-prisma-domain-er.svg) | erDiagram | Entities, cardinalities, key attributes |
| 13 | [`13-sequence-create-sale`](13-sequence-create-sale.mmd) | [`svg`](13-sequence-create-sale.svg) | sequenceDiagram | Credit-term, credit-limit, stock, invoice write |
| 14 | [`14-sequence-permission-check`](14-sequence-permission-check.mmd) | [`svg`](14-sequence-permission-check.svg) | sequenceDiagram | Route table → membership → `can()` |
| 15 | [`15-state-sale-lifecycle`](15-state-sale-lifecycle.mmd) | [`svg`](15-state-sale-lifecycle.svg) | stateDiagram-v2 | Pending/Completed/Cancelled/Deleted + guards |
| 16 | [`16-state-stock-movement`](16-state-stock-movement.mmd) | [`svg`](16-state-stock-movement.svg) | stateDiagram-v2 | FEFO, batch crediting, return routing |
| 17 | [`17-dependency-map`](17-dependency-map.mmd) | [`svg`](17-dependency-map.svg) | flowchart | Layer dependencies routes → middleware → services → shared → Prisma |

## Web UI diagrams

`apps/web` (Vite + React + React Router + SWR + react-hook-form) with the
`@dms/ui` shadcn-based component kit.

| # | Source (`.mmd`) | Rendered (`.svg`) | Type | Contents |
|---|---|---|---|---|
| 18 | [`18-ui-app-composition`](18-ui-app-composition.mmd) | [`svg`](18-ui-app-composition.svg) | flowchart | Provider/component tree: main → BrowserRouter → AuthProvider → App → guard → shell → pages |
| 19 | [`19-ui-route-map`](19-ui-route-map.mmd) | [`svg`](19-ui-route-map.svg) | flowchart | Every route and the navigation edges between pages, plus legacy aliases and the 404 |
| 20 | [`20-ui-state-ownership`](20-ui-state-ownership.mmd) | [`svg`](20-ui-state-ownership.svg) | classDiagram | Who holds what: AuthContext, SWR cache, local state, react-hook-form, localStorage, router state, toasts, outlet context |
| 21 | [`21-ui-swr-read-flow`](21-ui-swr-read-flow.mmd) | [`svg`](21-ui-swr-read-flow.svg) | sequenceDiagram | Read path: `useSWR` → `api` seam → axios interceptor → server → failure translation |
| 22 | [`22-ui-mutation-revalidation`](22-ui-mutation-revalidation.mmd) | [`svg`](22-ui-mutation-revalidation.svg) | sequenceDiagram | Write path: form submit → server → `mutate()` revalidation → toast |
| 23 | [`23-ui-auth-session-flow`](23-ui-auth-session-flow.mmd) | [`svg`](23-ui-auth-session-flow.svg) | sequenceDiagram | Session lifecycle, the guard's redirects, login and logout |
| 24 | [`24-ui-shell-composition`](24-ui-shell-composition.mmd) | [`svg`](24-ui-shell-composition.svg) | classDiagram | `AppShell` + sidebar, topbar, theme switch, company switcher, outlet context |

### Where UI state lives

| State | Owner | Mechanism |
|---|---|---|
| Signed-in user, session status, active Company | `AuthProvider` (`lib/auth.tsx`) | React Context fed by `authClient.useSession()` |
| Active membership (role, org id) | `useActiveMembership` (`lib/profile.ts`) | SWR key `active-membership` over the better-auth client |
| Server data (lists, reports, lookups) | SWR cache | `useSWR(key, fetcher)`; `mutate()` revalidates a key, `useSWRConfig().mutate()` all |
| Form fields, validation, submit state | `react-hook-form` + `zodResolver` | `useForm`, `useFieldArray`, `formState.errors/isSubmitting` |
| Page UI (paging, search, filters, dialogs, tabs) | the page component | `useState` |
| Bearer token, theme | `localStorage` | `auth_token` (axios interceptor), `dms-theme` |
| Navigation target / deep links | React Router | `useNavigate`, `useLocation().state.from`, query strings |
| Transient feedback | sonner | `toast.*` via `Toaster` and `showToast` outlet context |

### Page connection notes

- `/login` is the only route outside `RequireAuth`; everything else sits under
  the guard and then under `AppShell`.
- The guard redirects to `/onboarding` only while
  `activeOrganizationId === null`; once a Company is active it renders the
  shell.
- Listing pages share one shape: SWR list key + local page/search/filter state +
  a confirm dialog + `mutate()` after a write.
- Form pages share one shape: `react-hook-form` + Zod, SWR lookups for selects,
  `api.post/put`, then `navigate` back to the list.
- Switching Company is the one global invalidation: `globalMutate(() => true)`
  then `window.location.reload()`.

### Re-render everything

```bash
for f in docs/diagrams/*.mmd; do
  npx -y @mermaid-js/mermaid-cli -b white -i "$f" -o "${f%.mmd}.svg"
done
```

## Legend

| Notation | Meaning |
|---|---|
| `<<interface>>` | TypeScript `interface` / structural contract |
| `<<type>>` | TypeScript `type` alias (mostly `z.output<...>` Zod projections) |
| `<<enumeration>>` | Prisma `enum` or `const` string-union |
| `<<zod>>` | Runtime Zod schema (validator + type source) |
| `+` | Exported / public member |
| `*--` | Composition (owns) |
| `o--` | Aggregation |
| `-->` | Association / dependency |
| `..>` | Dependency (uses, no field) |
| `<|--` | Inheritance |

## Reference tables

### Prisma error → HTTP status

| Prisma code | Result |
|---|---|
| `P2002` | `409 UNIQUE_CONSTRAINT` |
| `P2003` | `400 FOREIGN_KEY_VIOLATION` |
| `P2014` | `400 RELATION_VIOLATION` |
| `P2025` | `404 NOT_FOUND` |
| `P2034` | `409 WRITE_CONFLICT` |
| `ZodError` | `400 VALIDATION_ERROR` |
| `entity.parse.failed` | `400` |

### Input normalization (`packages/shared/src/inputs.ts`)

| Helper | Empty/blank → | Meaning |
|---|---|---|
| `optionalText` | `undefined` | omitted field is a no-op on PUT |
| `nullableText` / `nullableEmail` | `null` | blank is a real edit that clears the column |
| `optionalNumber` / `optionalMoney` | `undefined` | not provided |
| `nullableMoneyInput` | `null` | `0` kept as `0` |
| `optionalPercent` | `undefined` | capped at 100 |

### Router mount order (`routes/index.ts`)

`products · purchases · sales · inventory · returns · customers · payments ·
suppliers · categories · brands · settings · roles · reports/inventory ·
reports/purchase · reports/sales · reports/aging · dashboard`

### Notable unique constraints

| Model | Constraint |
|---|---|
| `Member` | `@@unique([organizationId, userId])` |
| `Role` | `@@unique([name, organizationId])` |
| `RolePermission` | `@@unique([roleId, resource, action])` |
| `Category` | `@@unique([name, organizationId])` |
| `Brand` | `@@unique([name, categoryId, organizationId])` |
| `StockBatch` | `@@unique([productId, batchNumber, organizationId])` |
| `Inventory` | `productId @unique` |

### `AuthMode` branch (`app.ts`)

| `AuthMode` | `strict` | `bootstrap` |
|---|---|---|
| `session` (default) | `sessionAuthContext(auth)` | `sessionBootstrapAuthContext(auth)` |
| `trusted-proxy` | `authContext` | `bootstrapAuthContext` |
