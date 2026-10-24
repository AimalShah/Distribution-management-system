/**
 * Harness for the `qa/` domain-correctness suites (Phases 2–3).
 *
 * Same idea as `checkpoints/support/parity-db.ts`: the real `createApp` in
 * trusted-proxy mode against the local test database, caller chosen by the
 * `x-organization-id`/`x-user-id` headers, one fresh tenant pair per suite.
 *
 * Differences from the parity harness, on purpose:
 * - the database URL is resolved and *guarded* in `setup.ts` — it can never be
 *   the developer's `.env` (Neon) target;
 * - the fixture set is oriented at documents (inventory opening stock, a sale,
 *   a purchase), not just catalog rows, because the suites assert side
 *   effects across stock, money and ledger — not just 200s;
 * - cleanup deletes what it created, scoped by the minted ids only.
 */
import { expect } from "vitest";
import request from "supertest";
import type { Response } from "supertest";

import { createApp } from "../../apps/server/src/app";
import {
  ORGANIZATION_HEADER,
  USER_HEADER,
} from "../../apps/server/src/middleware/auth-context";
import prisma from "@dms/db";

export const app = createApp({ authMode: "trusted-proxy" });

let counter = 0;

/** Unique per process and per call, so a rerun never collides with leftovers. */
export const unique = (prefix: string): string =>
  `${prefix}-${process.pid.toString(36)}-${Date.now().toString(36)}-${counter++}`;

/** Money is only ever asserted to two decimals (and sometimes 0.01 tolerance). */
export const round2 = (value: number): number => Number(value.toFixed(2));

const money = (value: number) => Math.round(value * 100) / 100;

/** Money equality at 2 decimals — never softened to a "presence check". */
export const expectMoney = (actual: unknown, expected: number): void => {
  const a = typeof actual === "number" ? actual : Number(actual);
  expect(isFinite(a)).toBe(true);
  // 0.01 tolerance: the DB stores floats; exact 2-decimal equality is checked
  // after rounding, the tolerance only covers float drift.
  expect(Math.abs(money(a) - money(expected))).toBeLessThanOrEqual(0.011);
};

/* -------------------------------------------------------------------------- */
/* Request helpers                                                             */
/* -------------------------------------------------------------------------- */

export interface Caller {
  organizationId: string;
  userId: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    public method: string,
    public path: string
  ) {
    super(`${method} ${path} → ${status} ${JSON.stringify(body)}`);
  }
}

export const ok = async (
  res: Promise<Response>
): Promise<{ status: number; body: any }> => {
  const r = await res;
  if (r.status >= 400) {
    throw new ApiError(r.status, r.body, r.request?.method ?? "?", r.request?.url ?? "?");
  }

  return { status: r.status, body: r.body };
};

const headers = (t: Caller, extra?: Record<string, string>) => ({
  [ORGANIZATION_HEADER]: t.organizationId,
  [USER_HEADER]: t.userId,
  ...(extra ?? {}),
});

export const api = {
  get: (t: Caller, path: string) => ok(request(app).get(`/api${path}`).set(headers(t))),
  /** Deliberately unguarded — for the rejected-response assertions. */
  raw:
    (t: Caller) =>
    (method: string, path: string, body?: unknown) =>
      request(app)
        [method](`/api${path}`)
        .set(headers(t))
        .send(body ?? {}),
};

export const assertErr = async (
  res: Response,
  status: number,
  code?: string
): Promise<Record<string, any>> => {
  expect(res.status).toBe(status);

  if (code) expect(res.body?.code ?? res.body?.error?.code).toBe(code);

  return res.body;
};

/** A call expected to refuse with `status/code` — accepts a thrown ApiError
 *  or a resolved supertest Response; resolves to the body either way. */
export const expectRefusal = async (
  promise: Promise<{ status: number; body: any }>,
  status: number,
  code?: string
) => {
  let caught: unknown;
  let response: { status: number; body: any } | undefined;

  try {
    response = (await promise) ?? undefined;
  } catch (error) {
    caught = error;
  }

  if (caught === undefined && response === undefined) {
    throw new Error(`expected refusal (${status}${code ? ` ${code}` : ""}) but the request succeeded`);
  }

  const error = (caught ?? response) as ApiError & { status: number; body: any };
  expect(error.status).toBe(status);

  if (code) expect(error.body?.code ?? error.body?.error?.code).toBe(code);

  return error.body;
};

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

export interface Product {
  id: string;
  productCode: string;
  name: string;
  unitPrice: number;
  unitCost: number;
  gstRate: number;
}

export interface Tenant {
  organizationId: string;
  userId: string;
  categoryId: string;
  brandId: string;
  customer: { id: string; customerCode: string; name: string };
  supplier: { id: string; supplierCode: string; companyName: string };
  products: Product[];
  /** Products seeded for the *other* tenant, for isolation tests. */
  other: {
    organizationId: string;
    userId: string;
    categoryId: string;
    brandId: string;
    customer: { id: string };
    supplier: { id: string };
    products: Product[];
  };
}

export async function seedTenant(taxRate = 10): Promise<Tenant> {
  const at = new Date();

  const [org, otherOrg] = [unique("org-a"), unique("org-b")];

  const [user, otherUser] = await Promise.all([
    prisma.user.create({
      data: {
        id: unique("usr-a"),
        name: "QA User A",
        email: `qa-${unique("")}@example.test`,
        emailVerified: true,
        createdAt: at,
        updatedAt: at,
      },
    }),
    prisma.user.create({
      data: {
        id: unique("usr-b"),
        name: "QA User B",
        email: `qa-${unique("")}@example.test`,
        emailVerified: true,
        createdAt: at,
        updatedAt: at,
      },
    }),
  ]);

  await Promise.all([
    prisma.organization.create({ data: { id: org, name: `QA Org A ${unique("")}`, createdAt: at } }),
    prisma.organization.create({
      data: { id: otherOrg, name: `QA Org B ${unique("")}`, createdAt: at },
    }),
  ]);

  // (members must come after both their org and their user exist)
  await Promise.all([
    prisma.member.create({
      data: { id: unique("mem-a"), organizationId: org, userId: user.id, role: "owner", createdAt: at },
    }),
    prisma.member.create({
      data: {
        id: unique("mem-b"),
        organizationId: otherOrg,
        userId: otherUser.id,
        role: "owner",
        createdAt: at,
      },
    }),
  ]);

  const a: Caller = { organizationId: org, userId: user.id };
  const b: Caller = { organizationId: otherOrg, userId: otherUser.id };
  const call = api.raw(a);

  const makeCatalog = async (t: Caller, suffix: string): Promise<Omit<Tenant, "other" | "organizationId" | "userId">> => {
    const c = api.raw(t);
    const category = (
      await ok(c("post", "/categories", { name: `QA Category ${unique(suffix)}`, shortCode: null, description: null }))
    ).body;
    const brand = (
      await ok(
        c("post", "/brands", { name: `QA Brand ${unique(suffix)}`, categoryId: category.id, shortCode: null, description: null })
      )
    ).body;

    const product = (
      await ok(
        c("post", "/products", {
          name: `QA Product ${unique(suffix)}`,
          category: category.id,
          brand: brand.id,
          unit: "piece",
          unitCost: 10,
          unitPrice: 25,
          gstApplicable: true,
          gstRate: taxRate,
          isActive: true,
        })
      )
    ).body;

    const customer = (
      await ok(
        c("post", "/customers", {
          customerCode: unique("CUST"),
          name: `QA Customer ${unique(suffix)}`,
          phone: null,
          address: null,
          city: null,
          creditLimit: null,
          creditTermDays: null,
          isActive: true,
        })
      )
    ).body;

    const supplier = (
      await ok(
        c("post", "/suppliers", {
          supplierCode: unique("SUP"),
          contactPerson: `QA Contact ${unique(suffix)}`,
          companyName: `QA Supplier ${unique(suffix)}`,
          email: null,
          phone: null,
          address: null,
          city: null,
        })
      )
    ).body;

    return {
      categoryId: category.id,
      brandId: brand.id,
      customer,
      supplier,
      products: [product],
    };
  };

  const catalogA = await makeCatalog(a, "a");
  const catalogB = await makeCatalog(b, "b");

  return {
    organizationId: org,
    userId: user.id,
    categoryId: catalogA.categoryId,
    brandId: catalogA.brandId,
    customer: catalogA.customer,
    supplier: catalogA.supplier,
    products: catalogA.products,
    other: {
      organizationId: otherOrg,
      userId: otherUser.id,
      categoryId: catalogB.categoryId,
      brandId: catalogB.brandId,
      customer: catalogB.customer,
      supplier: catalogB.supplier,
      products: catalogB.products,
    },
  };
}

/** Delete everything a `seedTenant` created, leaf-first, org-scoped only.
 *  BOTH tenants go: seedTenant mints org A and org B (the isolation probe),
 *  and leaving org B behind would leak its catalog rows — a fresh org B
 *  restarts its SKU sequence at 1, and `productCode` uniqueness is global, so
 *  the next run's `seedTenant` would collide with the leaked `QAB-QAC-00001`
 *  and never seed. This leak is real: five orphaned `QA Org B` tenants were
 *  found in the QA DB after the returns-suite sessions (2026-10). */
export async function teardownTenant(t: Tenant): Promise<void> {
  const orgs = { in: [t.organizationId, t.other.organizationId] };

  await prisma.payment.deleteMany({ where: { organizationId: orgs } });
  await prisma.returnItem.deleteMany({ where: { return: { organizationId: orgs } } });
  await prisma.return.deleteMany({ where: { organizationId: orgs } });
  await prisma.saleItem.deleteMany({ where: { sale: { organizationId: orgs } } });
  await prisma.sale.deleteMany({ where: { organizationId: orgs } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { organizationId: orgs } } });
  await prisma.purchase.deleteMany({ where: { organizationId: orgs } });
  await prisma.inventoryLog.deleteMany({ where: { product: { organizationId: orgs } } });
  await prisma.stockBatch.deleteMany({ where: { organizationId: orgs } });
  await prisma.inventory.deleteMany({ where: { organizationId: orgs } });
  await prisma.product.deleteMany({ where: { organizationId: orgs } });
  await prisma.brand.deleteMany({ where: { organizationId: orgs } });
  await prisma.category.deleteMany({ where: { organizationId: orgs } });
  await prisma.customer.deleteMany({ where: { organizationId: orgs } });
  await prisma.supplier.deleteMany({ where: { organizationId: orgs } });
  await prisma.role.deleteMany({ where: { organizationId: orgs } });
  await prisma.member.deleteMany({ where: { organizationId: orgs } });
  await prisma.organization.deleteMany({ where: { id: { in: [t.organizationId, t.other.organizationId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [t.userId, t.other.userId] } } });
}

/** Create an isolated customer (its own ledger space) inside the tenant. */
export async function createIsolatedCustomer(t: Caller, label: string) {
  return (
    await ok(
      api.raw(t)("post", "/customers", {
        customerCode: unique("CUST"),
        name: `QA Customer ${label} ${unique("")}`,
        phone: null,
        address: null,
        city: null,
        creditLimit: null,
        creditTermDays: null,
        isActive: true,
      })
    )
  ).body;
}

/* -------------------------------------------------------------------------- */
/* Document builders                                                           */
/* -------------------------------------------------------------------------- */

/** POST /inventory — the opening-stock row every sale/purchase needs. */
export async function seedStock(
  t: Caller,
  product: Product,
  quantityOnHand: number
): Promise<{ id: string; quantityOnHand: number }> {
  return (
    await ok(
      api.raw(t)("post", "/inventory", {
        productId: product.id,
        quantityOnHand,
        reorderLevel: 10,
      })
    )
  ).body;
}

export interface SaleLine {
  productId: string;
  quantity: number;
  unitPrice?: number;
  taxPercent?: number;
}

export interface SaleDraft {
  customerId: string;
  items: SaleLine[];
  status?: "Pending" | "Completed" | "Cancelled";
  isInterState?: boolean;
  discount?: number;
  invoiceType?: "regular" | "tax";
}

export const defaultSale = (draft: SaleDraft) => ({
  saleCode: unique("SALE"),
  customerId: draft.customerId,
  status: draft.status ?? "Completed",
  invoiceType: draft.invoiceType ?? "regular",
  isInterState: draft.isInterState ?? false,
  discount: draft.discount ?? 0,
  items: draft.items.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    unitPrice: line.unitPrice ?? 25,
    taxPercent: line.taxPercent ?? 10,
  })),
});

export async function createSale(t: Caller, draft: SaleDraft) {
  return (await ok(api.raw(t)("post", "/sales", defaultSale(draft)))).body;
}

export async function createPurchase(
  t: Caller,
  supplierId: string,
  items: { productId: string; quantity: number; unitCost?: number; taxPercent?: number }[],
  extra?: { discount?: number; status?: string; batchNumber?: string; expiryDate?: string | null }
) {
  return (
    await ok(
      api.raw(t)("post", "/purchases", {
        purchaseCode: unique("PO"),
        supplierId,
        purchaseDate: new Date().toISOString(),
        status: extra?.status ?? "Received",
        discount: extra?.discount ?? 0,
        items: items.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost ?? 10,
          taxPercent: line.taxPercent ?? 10,
          itemDiscount: 0,
          batchNumber: extra?.batchNumber ?? null,
          expiryDate: extra?.expiryDate ?? null,
        })),
      })
    )
  ).body;
}

export interface ReturnLine {
  productId: string;
  quantity: number;
  condition?: "RESTOCKABLE" | "DAMAGED";
  reason?: string;
  /** Client figures the API schema still demands; the service must ignore them. */
  unitPrice?: number;
  taxAmount?: number;
  discount?: number;
}

export interface ReturnDraft {
  returnCode?: string;
  returnType: "SALE" | "PURCHASE" | "EXPIRED" | "DAMAGED";
  saleId?: string;
  purchaseId?: string;
  reason?: string;
  items: ReturnLine[];
}

export async function createReturn(t: Caller, draft: ReturnDraft) {
  return (
    await ok(
      api.raw(t)("post", "/returns", {
        returnCode: draft.returnCode ?? unique("RET"),
        returnType: draft.returnType,
        saleId: draft.saleId,
        purchaseId: draft.purchaseId,
        reason: draft.reason ?? "QA",
        returnDate: new Date().toISOString(),
        items: draft.items.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          condition: line.condition ?? "RESTOCKABLE",
          reason: line.reason ?? (line.condition === "DAMAGED" ? "QA damaged" : undefined),
          // Client figures included on purpose: the service is expected to
          // derive its own from the document and refuse to bank these.
          unitPrice: line.unitPrice ?? 66.6,
          taxAmount: line.taxAmount ?? 6.66,
          discount: line.discount ?? 6.66,
        })),
      })
    )
  ).body;
}

export async function createPayment(
  t: Caller,
  draft: {
    customerId: string;
    saleId?: string;
    amount: number;
    method?: string;
  }
) {
  return (
    await ok(
      api.raw(t)("post", "/payments", {
        paymentCode: unique("PAY"),
        customerId: draft.customerId,
        saleId: draft.saleId,
        amount: draft.amount,
        method: draft.method ?? "Cash",
      })
    )
  ).body;
}

/* -------------------------------------------------------------------------- */
/* Read-back helpers (side-effect assertions)                                  */
/* -------------------------------------------------------------------------- */

/** One inventory row for a product, via the API (what the UI would read). */
export const inventoryRow = async (t: Caller, productId: string) => {
  const page = (await ok(api.raw(t)("get", `/inventory?pageSize=100`))).body;
  const rows = page?.data ?? page;

  if (!Array.isArray(rows)) throw new Error("inventory list is not an array");

  const row = rows.find((r) => r.productId === productId || r.product?.id === productId);

  if (!row) throw new Error(`no inventory row for product ${productId} — list had ${rows.length} rows`);

  return row;
};

/**
 * The movement ledger for a product: the InventoryLog rows the API list
 * exposes (`GET /inventory/logs`), newest first.
 */
export const ledgerRows = async (t: Caller, productId: string) => {
  const page = (await ok(
    api.raw(t)("get", `/inventory/logs?pageSize=100&productId=${productId}`)
  )).body;
  const rows = page?.data ?? page;

  if (!Array.isArray(rows)) throw new Error("inventory log list is not an array");

  return rows.filter((r) => r.productId === productId || r.product?.id === productId);
};

/** The stored document — includes the items the client figures are banked into. */
export async function saleDetail(t: Caller, saleId: string) {
  return (await ok(api.raw(t)("get", `/sales/${saleId}`))).body;
}

export async function returnDetail(t: Caller, returnIdOrCode: string) {
  return (await ok(api.raw(t)("get", `/returns/${returnIdOrCode}`))).body;
}

export async function purchaseDetail(t: Caller, purchaseId: string) {
  return (await ok(api.raw(t)("get", `/purchases/${purchaseId}`))).body;
}

/** The derived customer balance (closing) from the ledger endpoint. */
export async function customerBalance(t: Caller, customerId: string): Promise<number> {
  const ledger = (await ok(api.raw(t)("get", `/customers/${customerId}/ledger`))).body;
  const closing = ledger?.totals?.closingBalance ?? ledger?.summary?.closingBalance;

  if (closing === undefined || !isFinite(Number(closing))) {
    throw new Error(`ledger response has no numeric closingBalance: ${JSON.stringify(ledger).slice(0, 300)}`);
  }

  return money(Number(closing));
}

/** Stock-batch quantities for a product (batch plane of the invariant). */
export const batchQuantities = async (t: Caller, productId: string) => {
  const page = (await ok(api.raw(t)("get", `/inventory/batches?pageSize=100`))).body;
  const rows = page?.data ?? page;

  if (!Array.isArray(rows)) throw new Error("batches list is not an array");

  return rows.filter((r) => r.productId === productId).map((r) => ({
    batchNumber: r.batchNumber,
    quantityRemaining: r.quantityRemaining,
    expiryDate: r.expiryDate,
  }));
}
