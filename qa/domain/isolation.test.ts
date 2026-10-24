/**
 * Domain correctness of multi-tenant isolation (Phase 2).
 *
 * Scoping rules defined in `docs/qa/operations-matrix.md` (Section 7):
 *   Tenant A must never see, mutate, or leak Tenant B's records across:
 *     - Products: GET /products/:id (404), list excludes
 *     - Customers: GET /customers/:id (404), ledger (404)
 *     - Suppliers: GET /suppliers/:id (404)
 *     - Sales: GET /sales/:id (404), cancel/delete (404)
 *     - Purchases: GET /purchases/:id (404), delete (404)
 *     - Payments: GET /payments/:id (404)
 *     - Inventory: list/logs/batches exclude foreign tenant
 *
 * Cross-tenant mutation guards:
 *   - Sale create: foreign customer (400) / foreign product (400)
 *   - Sale update: foreign customer (400) / foreign product recompute (400, F-12)
 *   - Purchase create: foreign supplier (400, F-3) / foreign product (400)
 *   - Payment create: foreign sale (400)
 */
import { afterAll, beforeAll, describe, it, expect } from "vitest";

import prisma from "@dms/db";
import {
  ApiError,
  api,
  createIsolatedCustomer,
  createPayment,
  createPurchase,
  createSale,
  expectMoney,
  expectRefusal,
  inventoryRow,
  ledgerRows,
  round2,
  seedStock,
  seedTenant,
  teardownTenant,
  unique,
  type Caller,
  type Tenant,
} from "../support/harness";

let t!: Tenant;

beforeAll(async () => {
  t = await seedTenant(10);
});

afterAll(async () => {
  await teardownTenant(t);
  await prisma.$disconnect();
});

/* -------------------------------------------------------------------------- */
/* Small helpers                                                               */

const rawA = (m: string, p: string, b?: unknown) => api.raw(t)(m as any, p, b);
const rawB = (m: string, p: string, b?: unknown) =>
  api.raw({ organizationId: t.other.organizationId, userId: t.other.userId })(m as any, p, b);

const expectOk = async (resP: Promise<any>) => {
  const res = await resP;

  if (res.status >= 400) {
    throw new ApiError(res.status, res.body, res.request?.method ?? "?", res.request?.url ?? "?");
  }

  return res;
};

const newProductFor = async (caller: Caller, name: string) => {
  const cat = caller.organizationId === t.organizationId ? t.categoryId : t.other.categoryId;
  const br = caller.organizationId === t.organizationId ? t.brandId : t.other.brandId;
  const res = await expectOk(
    api.raw(caller)("post", "/products", {
      productCode: unique("SKU"),
      name: unique(name),
      category: cat,
      brand: br,
      unit: "piece",
      unitCost: 10,
      unitPrice: 25,
      gstApplicable: true,
      gstRate: 10,
      isActive: true,
    })
  );

  return res.body as { id: string; productCode: string };
};

/* -------------------------------------------------------------------------- */

describe("tenant isolation — read boundary (Tenant A cannot see Tenant B)", () => {
  it("GET /products/:id returns 404 for Tenant B's product", async () => {
    const foreign = t.other.products[0];
    const res = await rawA("get", `/products/${foreign.id}`);
    expect(res.status).toBe(404);
  });

  it("GET /customers/:id and /ledger return 404 for Tenant B's customer", async () => {
    const foreign = t.other.customer;
    const resDetail = await rawA("get", `/customers/${foreign.id}`);
    expect(resDetail.status).toBe(404);

    const resLedger = await rawA("get", `/customers/${foreign.id}/ledger`);
    expect(resLedger.status).toBe(404);
  });

  it("GET /suppliers/:id returns 404 for Tenant B's supplier", async () => {
    const foreign = t.other.supplier;
    const res = await rawA("get", `/suppliers/${foreign.id}`);
    expect(res.status).toBe(404);
  });

  it("GET /sales/:id returns 404 for Tenant B's sale", async () => {
    const bCaller: Caller = { organizationId: t.other.organizationId, userId: t.other.userId };
    const pB = await newProductFor(bCaller, "sale-b-read");
    await seedStock(bCaller, pB as any, 20);
    const saleB = await createSale(bCaller, {
      customerId: t.other.customer.id,
      items: [{ productId: pB.id, quantity: 2 }],
    });

    const res = await rawA("get", `/sales/${saleB.id}`);
    expect(res.status).toBe(404);
  });

  it("GET /purchases/:id returns 404 for Tenant B's purchase", async () => {
    const bCaller: Caller = { organizationId: t.other.organizationId, userId: t.other.userId };
    const pB = await newProductFor(bCaller, "po-b-read");
    const poB = await createPurchase(bCaller, t.other.supplier.id, [
      { productId: pB.id, quantity: 10, unitCost: 15 },
    ]);

    const res = await rawA("get", `/purchases/${poB.id}`);
    expect(res.status).toBe(404);
  });
});

describe("tenant isolation — mutation boundary (Tenant A cannot mutate Tenant B)", () => {
  it("Tenant A cannot cancel or delete Tenant B's sale", async () => {
    const bCaller: Caller = { organizationId: t.other.organizationId, userId: t.other.userId };
    const pB = await newProductFor(bCaller, "sale-b-mut");
    await seedStock(bCaller, pB as any, 20);
    const saleB = await createSale(bCaller, {
      customerId: t.other.customer.id,
      items: [{ productId: pB.id, quantity: 2 }],
    });

    const cancelRes = await rawA("post", `/sales/${saleB.id}/cancel`);
    expect(cancelRes.status).toBe(404);

    const deleteRes = await rawA("delete", `/sales/${saleB.id}`);
    expect(deleteRes.status).toBe(404);
  });

  it("Tenant A cannot delete Tenant B's purchase", async () => {
    const bCaller: Caller = { organizationId: t.other.organizationId, userId: t.other.userId };
    const pB = await newProductFor(bCaller, "po-b-del");
    const poB = await createPurchase(bCaller, t.other.supplier.id, [
      { productId: pB.id, quantity: 5, unitCost: 10 },
    ]);

    const res = await rawA("delete", `/purchases/${poB.id}`);
    expect(res.status).toBe(404);
  });

  it("Tenant A cannot create a sale referencing Tenant B's customer", async () => {
    const pA = await newProductFor(t, "sale-a-cust");
    await seedStock(t, pA as any, 20);

    const res = await expectRefusal(
      createSale(t, { customerId: t.other.customer.id, items: [{ productId: pA.id, quantity: 1 }] }),
      400,
      "CUSTOMER_NOT_IN_ORGANIZATION"
    );
    expect(res).toBeDefined();
  });

  it("Tenant A cannot create a sale referencing Tenant B's product", async () => {
    const foreignProd = t.other.products[0];

    const res = await expectRefusal(
      createSale(t, { customerId: t.customer.id, items: [{ productId: foreignProd.id, quantity: 1 }] }),
      400,
      "PRODUCT_NOT_IN_ORGANIZATION"
    );
    expect(res).toBeDefined();
  });

  it("Tenant A updateSale recompute refuses foreign product with PRODUCT_NOT_IN_ORGANIZATION (F-12)", async () => {
    const pA = await newProductFor(t, "sale-a-f12");
    await seedStock(t, pA as any, 20);
    const sale = await createSale(t, {
      customerId: t.customer.id,
      items: [{ productId: pA.id, quantity: 2 }],
    });

    // Simulate an invoice whose line references a foreign product (F-12 gap)
    const saleItem = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });
    await prisma.saleItem.update({
      where: { id: saleItem.id },
      data: { productId: t.other.products[0].id },
    });

    // PUT changing discount calls deriveSaleMoney, which must check organizationId
    const res = await rawA("put", `/sales/${sale.id}`, { discount: 5 });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe("PRODUCT_NOT_IN_ORGANIZATION");
  });
});
