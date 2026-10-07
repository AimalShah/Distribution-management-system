/**
 * Shared fixtures for the Checkpoint 2 parity suites.
 *
 * ## Why these suites use a real database
 *
 * The 628 tests in `apps/server` mock `@dms/db`. That is the right default --
 * they are fast, hermetic, and they pin down routing, validation and tenant
 * scoping at the query-shape level. But a mock cannot observe the three things
 * this checkpoint is actually about:
 *
 * 1. **Constraints the schema declares but no service checks.** A mocked
 *    `product.create` succeeds no matter what it is handed. The real one fails on
 *    `productCode @unique`, on the `Brand.categoryId` foreign key, and on the
 *    composite uniques. `P2002`/`P2003` map to 409/400 in
 *    `http/prisma-errors.ts`, and that mapping is unreachable from a mock.
 * 2. **Tenant scoping that depends on a relation, not a column.** A product
 *    belongs to a tenant through `organizationId`, but a *brand* reaches its
 *    tenant through `categoryId -> Category.organizationId`. A mocked lookup
 *    cannot tell you whether the second hop is enforced.
 * 3. **Aggregation across rows.** The three report endpoints run `groupBy` and
 *    `aggregate`. A mock asserts the query it was told to expect; it cannot
 *    confirm the numbers the database actually returns.
 *
 * So these suites are deliberately *not* a second copy of the server tests. They
 * keep to what a database is the only thing that can answer.
 *
 * ## Isolation
 *
 * Each suite creates two organizations and deletes them afterwards, so suites stay
 * independent of each other and of whatever is already in the database. Nothing
 * here truncates: a `DELETE` aimed at a table holding real rows would be a far
 * worse outcome than a slow test.
 *
 * ## Skipping
 *
 * With no `DATABASE_URL` the suites skip, and say so in the output. That is the one
 * concession to convenience, and it is guarded: `requires-database.test.ts` asserts
 * that the gate refuses to pass in CI while a gated suite is skipping, so this
 * cannot quietly become the normal case.
 */
import fs from "node:fs";
import path from "node:path";
import { expect } from "vitest";
import request from "supertest";

import { createApp } from "../../apps/server/src/app";
import {
  ORGANIZATION_HEADER,
  SESSION_HEADER,
  USER_HEADER,
} from "../../apps/server/src/middleware/auth-context";
import prisma from "@dms/db";

const root = path.resolve(__dirname, "..", "..");

/**
 * Resolve `DATABASE_URL` without adding a dependency.
 *
 * Vitest does not load `.env` for the files this config includes, and `dotenv` is
 * not a workspace dependency. Real environment variables win, so CI injects its
 * own and this stays a local-development convenience.
 *
 * The `process.env` assignment has to happen before `@dms/db` is first evaluated:
 * `packages/db/src/client.ts` constructs the Prisma client at import time, and
 * Prisma reads `DATABASE_URL` then. That is why the import below is a static
 * import that appears *after* this block in evaluation order -- it does not,
 * which is exactly why this is a known sharp edge rather than a solved problem.
 * `vitest.config.ts` does not set up a global setup file, so the reliable fix is
 * for CI to export the variable, and for local runs to have a `.env` this can read.
 */
function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();

  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return undefined;

  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const match = /^\s*DATABASE_URL\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    // `.env` files usually quote URLs because they contain `?` and `&`.
    const value = match[1].replace(/^["']|["']$/g, "").trim();
    if (value) return value;
  }
  return undefined;
}

const databaseUrl = resolveDatabaseUrl();

/** `false` when there is no database to talk to. */
export const hasDatabase = Boolean(databaseUrl);

/** Surfaced in the skip message so the fix is obvious from the output. */
export const skipReason = hasDatabase
  ? undefined
  : "no DATABASE_URL resolved (set it in the environment, or in the repository-root .env)";

/**
 * Set before any query runs.
 *
 * `createApp()` and the services hold a reference to the client built at import
 * time, so this cannot retroactively repoint an already-constructed client. In
 * practice `DATABASE_URL` is present in the process before Vitest loads this
 * module (CI exports it; locally it is read from `.env` on the first import), so
 * the assignment below only covers the case where the value came from `.env`.
 */
if (databaseUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL_UNPOOLED ||= databaseUrl;
}

/**
 * One app for the process; `createApp()` is pure wiring.
 *
 * Trusted-proxy mode, explicitly: these suites assert tenant scoping, database
 * constraints and report arithmetic, and the helpers below choose the caller by
 * header so a test can name any tenant, user or session in one line. Who the
 * caller *is* -- sign-in, sessions, the active organization, membership being
 * re-checked per request -- is checkpoint 3's suite, which runs the default
 * session mode against the same database.
 */
export const app = createApp({ authMode: "trusted-proxy" });

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

let counter = 0;

/** Unique per process and per call, so a rerun never collides with leftovers. */
export const unique = (prefix: string): string =>
  `${prefix}-${process.pid.toString(36)}-${Date.now().toString(36)}-${counter++}`;

export interface Tenant {
  organizationId: string;
  userId: string;
  categoryId: string;
  brandId: string;
  productId: string;
  customerId: string;
  supplierId: string;
  otherOrganizationId: string;
  otherUserId: string;
  otherCategoryId: string;
  otherBrandId: string;
  otherProductId: string;
  otherCustomerId: string;
  otherSupplierId: string;
}

/**
 * Create two fully independent tenants.
 *
 * The second is the point of half the assertions: "this tenant's rows are
 * invisible to that tenant" only means something with a real second tenant to be
 * invisible to. A fixture that reused the first org's ids would let every such
 * test pass for the wrong reason.
 */
export async function seedTenants(): Promise<Tenant> {
  const at = new Date();

  const org = await prisma.organization.create({
    data: { id: `org_${unique("a")}`, name: `Parity A ${unique("")}`, createdAt: at },
  });
  const otherOrg = await prisma.organization.create({
    data: { id: `org_${unique("b")}`, name: `Parity B ${unique("")}`, createdAt: at },
  });

  // `user.id` has no default -- it is a better-auth identifier, not a cuid -- and
  // `email` is globally unique. Both are constraints the baseline migration
  // enforces, which is part of why these are created through Prisma rather than
  // assumed.
  const user = await prisma.user.create({
    data: {
      id: `usr_${unique("a")}`,
      name: "Parity User A",
      email: `${unique("parity-a")}@example.test`,
      emailVerified: true,
      createdAt: at,
      updatedAt: at,
    },
  });
  const otherUser = await prisma.user.create({
    data: {
      id: `usr_${unique("b")}`,
      name: "Parity User B",
      email: `${unique("parity-b")}@example.test`,
      emailVerified: true,
      createdAt: at,
      updatedAt: at,
    },
  });

  // Exercises the composite unique the schema comment calls out: one membership
  // per user per organization.
  await prisma.member.create({
    data: { id: `mem_${unique("a")}`, organizationId: org.id, userId: user.id, role: "owner", createdAt: at },
  });
  await prisma.member.create({
    data: { id: `mem_${unique("b")}`, organizationId: otherOrg.id, userId: otherUser.id, role: "owner", createdAt: at },
  });

  const category = await prisma.category.create({
    data: { id: `cat_${unique("a")}`, name: unique("Category"), organizationId: org.id },
  });
  const otherCategory = await prisma.category.create({
    data: { id: `cat_${unique("b")}`, name: unique("Category"), organizationId: otherOrg.id },
  });

  // A brand reaches its tenant through its category, which is what makes the
  // cross-tenant brand assertions meaningful.
  const brand = await prisma.brand.create({
    data: { id: `brd_${unique("a")}`, name: unique("Brand"), organizationId: org.id, categoryId: category.id },
  });
  const otherBrand = await prisma.brand.create({
    data: { id: `brd_${unique("b")}`, name: unique("Brand"), organizationId: otherOrg.id, categoryId: otherCategory.id },
  });

  const product = await prisma.product.create({
    data: {
      id: `prd_${unique("a")}`,
      productCode: unique("SKU"),
      organizationId: org.id,
      name: "Parity Product",
      categoryId: category.id,
      brandId: brand.id,
      unit: "pcs",
      unitCost: 10,
      unitPrice: 20,
    },
  });
  const otherProduct = await prisma.product.create({
    data: {
      id: `prd_${unique("b")}`,
      productCode: unique("SKU"),
      organizationId: otherOrg.id,
      name: "Parity Product (other tenant)",
      categoryId: otherCategory.id,
      brandId: otherBrand.id,
      unit: "pcs",
      unitCost: 10,
      unitPrice: 20,
    },
  });

  const customer = await prisma.customer.create({
    data: { id: `cus_${unique("a")}`, customerCode: unique("CUST"), organizationId: org.id, name: "Parity Customer" },
  });
  const otherCustomer = await prisma.customer.create({
    data: {
      id: `cus_${unique("b")}`,
      customerCode: unique("CUST"),
      organizationId: otherOrg.id,
      name: "Parity Customer (other tenant)",
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      id: `sup_${unique("a")}`,
      supplierCode: unique("SUPP"),
      organizationId: org.id,
      contactPerson: "Parity Contact",
      companyName: "Parity Supplier",
    },
  });
  const otherSupplier = await prisma.supplier.create({
    data: {
      id: `sup_${unique("b")}`,
      supplierCode: unique("SUPP"),
      organizationId: otherOrg.id,
      contactPerson: "Parity Contact",
      companyName: "Parity Supplier (other tenant)",
    },
  });

  return {
    organizationId: org.id,
    userId: user.id,
    categoryId: category.id,
    brandId: brand.id,
    productId: product.id,
    customerId: customer.id,
    supplierId: supplier.id,
    otherOrganizationId: otherOrg.id,
    otherUserId: otherUser.id,
    otherCategoryId: otherCategory.id,
    otherBrandId: otherBrand.id,
    otherProductId: otherProduct.id,
    otherCustomerId: otherCustomer.id,
    otherSupplierId: otherSupplier.id,
  };
}

/**
 * Remove everything the fixture created.
 *
 * Leaf-first. `organization` cascades to most children, but the models without an
 * `onDelete` (Product -> Brand, Purchase -> Supplier, Return -> User) hold the
 * reference, so the leaves have to go first. Every statement is scoped by
 * `organizationId` or by the exact ids the fixture minted, which is what makes it
 * safe to run against a database holding other rows.
 */
export async function teardownTenants(t: Tenant): Promise<void> {
  const orgs = [t.organizationId, t.otherOrganizationId];
  const inOrgs = { in: orgs };

  // Money leaves before the documents it settles: `payments.customerId` is
  // RESTRICT, so a customer row cannot go while a payment still points at it.
  await prisma.payment.deleteMany({ where: { organizationId: inOrgs } });
  await prisma.returnItem.deleteMany({ where: { return: { organizationId: inOrgs } } });
  await prisma.return.deleteMany({ where: { organizationId: inOrgs } });
  await prisma.saleItem.deleteMany({ where: { sale: { organizationId: inOrgs } } });
  await prisma.sale.deleteMany({ where: { organizationId: inOrgs } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { organizationId: inOrgs } } });
  await prisma.purchase.deleteMany({ where: { organizationId: inOrgs } });
  await prisma.inventoryLog.deleteMany({ where: { inventory: { organizationId: inOrgs } } });
  await prisma.inventory.deleteMany({ where: { organizationId: inOrgs } });
  await prisma.product.deleteMany({ where: { organizationId: inOrgs } });
  await prisma.brand.deleteMany({ where: { organizationId: inOrgs } });
  await prisma.category.deleteMany({ where: { organizationId: inOrgs } });
  await prisma.customer.deleteMany({ where: { organizationId: inOrgs } });
  await prisma.supplier.deleteMany({ where: { organizationId: inOrgs } });
  await prisma.member.deleteMany({ where: { organizationId: inOrgs } });
  await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
  await prisma.user.deleteMany({ where: { id: { in: [t.userId, t.otherUserId] } } });
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The headers the API actually reads.
 *
 * The old suites sent `Authorization: Bearer ${authToken}` with `authToken` never
 * assigned, so every request went out as `Bearer undefined` and the API answered
 * 400 `ORGANIZATION_REQUIRED`. Nothing was wrong with the API -- the tests were
 * authenticating to a mechanism that stopped existing in 02a. Since checkpoint 3
 * these are the trusted-proxy headers (see `AuthMode` in
 * `middleware/auth-context.ts`); the default mode ignores them.
 */
export const asOrg = (organizationId: string) => ({ [ORGANIZATION_HEADER]: organizationId });

export const asUser = (organizationId: string, userId: string) => ({
  [ORGANIZATION_HEADER]: organizationId,
  [USER_HEADER]: userId,
});

export const asSession = (organizationId: string, sessionId: string, userId?: string) => ({
  [ORGANIZATION_HEADER]: organizationId,
  [SESSION_HEADER]: sessionId,
  ...(userId ? { [USER_HEADER]: userId } : {}),
});

/** The body shape `errorHandler` produces, for `toMatchObject`. */
export const errorBody = {
  validation: { code: "VALIDATION_ERROR" },
  unique: { code: "UNIQUE_CONSTRAINT" },
  foreignKey: { code: "FOREIGN_KEY_VIOLATION" },
  notFound: { code: "PRODUCT_NOT_FOUND" },
  organizationRequired: { code: "ORGANIZATION_REQUIRED" },
  routeNotFound: { code: "ROUTE_NOT_FOUND" },
  // 422 codes, not 400: the body is well-formed and the id names a real row, so
  // there is nothing for the caller to correct. `http/errors.ts` explains why the
  // distinction is worth keeping.
  brandNotInOrganization: { code: "BRAND_NOT_IN_ORGANIZATION" },
  categoryNotInOrganization: { code: "CATEGORY_NOT_IN_ORGANIZATION" },
} as const;

export {
  request,
  expect,
  prisma,
  ORGANIZATION_HEADER,
  USER_HEADER,
  SESSION_HEADER,
};
