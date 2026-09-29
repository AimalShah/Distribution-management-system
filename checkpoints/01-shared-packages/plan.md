# Checkpoint 1 — Shared Packages: Plan

## Goal

Populate the shared packages with Prisma schema, Zod schemas, and shadcn UI components needed by the current pages.

## Steps

### 1. `packages/db` — Prisma package

- Copy `prisma/schema.prisma` verbatim from repo root to `packages/db/prisma/schema.prisma`
- Copy `prisma/seed.ts` to `packages/db/prisma/seed.ts`
- Create `packages/db/package.json`:
  ```json
  {
    "name": "@dms/db",
    "version": "0.0.0",
    "private": true,
    "main": "./src/index.ts",
    "scripts": {
      "generate": "prisma generate",
      "migrate": "prisma migrate dev",
      "seed": "tsx prisma/seed.ts"
    },
    "dependencies": {
      "@prisma/client": "^6.12.0"
    },
    "devDependencies": {
      "prisma": "^6.13.0",
      "tsx": "^4.20.3"
    }
  }
  ```
- Create `packages/db/src/index.ts`:
  ```typescript
  import { PrismaClient } from "@prisma/client";
  const prisma = new PrismaClient();
  export default prisma;
  export * from "@prisma/client";
  ```
- Update `prisma/schema.prisma` generator output to `./generated/` (relative to package)

### 2. `packages/shared` — Zod schemas

- Create `packages/shared/package.json`:
  ```json
  {
    "name": "@dms/shared",
    "version": "0.0.0",
    "private": true,
    "main": "./src/index.ts"
  }
  ```
- Create `packages/shared/src/pagination.ts` (from architecture plan §5):
  ```typescript
  import { z } from "zod";
  export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  });
  export const paginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
    z.object({ data: z.array(item), pageCount: z.number().int(), total: z.number().int() });
  ```
- Create `packages/shared/src/schemas/` with Zod schemas ported from `src/validations/schemas.ts`:
  - `product.ts` — ProductSchema, ProductInput, ProductOutput types
  - `purchase.ts` — PurchaseFormSchema, PurchaseItemSchema
  - `sale.ts` — SaleInvoiceSchema, SaleInvoiceItemSchema
  - `return.ts` — ReturnFormSchema, ReturnItemSchema
  - `customer.ts` — CustomerSchema
  - `supplier.ts` — SupplierSchema
  - `category.ts` — CategorySchema
  - `brand.ts` — BrandSchema
  - `auth.ts` — LoginSchema, SignupSchema, RegisterCompanySchema, ProfileSchema, UpdatePasswordSchema
  - `inventory.ts` — InventoryAdjustSchema, InventorySettingsSchema
- Create `packages/shared/src/index.ts` re-exporting all schemas and types

### 3. `packages/ui` — shadcn/ui components

- Create `packages/ui/package.json` with React 19, Radix UI, Tailwind, CVA, clsx, tailwind-merge, lucide-react
- Create `packages/ui/components.json` for shadcn CLI
- Run `pnpm dlx shadcn@latest init` in `packages/ui`
- Add only the components current pages actually use (audit of `src/components/ui/` shows these are used):
  - `button`, `input`, `label`, `select`, `textarea`, `checkbox`, `switch`
  - `table`, `dialog`, `dropdown-menu`, `tabs`, `card`, `badge`
  - `form`, `popover`, `calendar`, `date-range`, `sheet`
  - `avatar`, `separator`, `skeleton`, `sonner`, `tooltip`
  - `accordion`, `alert`, `progress`, `sidebar`, `chart`
- Create `packages/ui/src/components/data-table.tsx` — shared DataTable wrapper (from architecture plan §5)
- Create `packages/ui/src/index.ts` re-exporting all components

### 4. Config packages

- `packages/config-eslint/` — shared ESLint config with TypeScript rules
- `packages/config-typescript/` — shared tsconfig base with strict mode, path aliases

## Verification

- `pnpm --filter db run generate` produces Prisma client
- `pnpm --filter shared run build` (if needed) or TypeScript compiles
- `pnpm --filter ui run build` succeeds
- All Zod schemas validate the same inputs as the original `src/validations/schemas.ts`
