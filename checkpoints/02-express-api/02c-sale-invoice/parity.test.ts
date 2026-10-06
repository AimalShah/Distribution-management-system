/**
 * Checkpoint 2c — Sale / Invoice API: Parity Test
 *
 * Scope: the stock deduction, and the one legacy bug in this checkpoint that a
 * database is uniquely able to catch.
 *
 * `source-review.md` and the service both record it: the legacy `addSaleInvoice`
 * "deducted optimistically and clamped at zero -- `quantityOnHand: Math.max(0,
 * newQty)` with only a `console.warn`". Selling 10 of 5 in stock left 0 on hand
 * *and* wrote an `OUT` log of 10 whose own `previousQty`/`newQty` pair said only 5
 * had moved. The ledger contradicted itself, and the shortfall was invisible
 * because nothing refused the document.
 *
 * Two assertions follow from that, and both need real rows to mean anything:
 * the oversell is refused, and the refusal writes nothing at all.
 *
 * The second point is the one that generalises. `createSale` runs five writes in
 * one transaction -- the sale, its lines, one guarded decrement per line, and one
 * ledger entry per line. The tests below force a failure *after* the first write
 * (a well-formed but unknown `x-user-id` trips the `InventoryLog.userId` foreign
 * key) and assert the tables came back clean. A mocked suite cannot express that
 * assertion, because there is no such thing as a rolled-back mock.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  app,
  asOrg,
  asUser,
  errorBody,
  hasDatabase,
  prisma,
  request,
  seedTenants,
  skipReason,
  teardownTenants,
  unique,
  type Tenant,
} from "../../support/parity-db";

describe.skipIf(!hasDatabase)("Checkpoint 2c — Sale / Invoice API", () => {
  let t: Tenant;

  beforeAll(async () => {
    t = await seedTenants();
  });

  afterAll(async () => {
    if (t) await teardownTenants(t);
  });

  /** A product holding `qty` units, so each test controls its own stock. */
  const stockedProduct = async (qty: number) => {
    const product = await prisma.product.create({
      data: {
        productCode: unique("SKU"),
        organizationId: t.organizationId,
        name: "Stocked for parity",
        categoryId: t.categoryId,
        brandId: t.brandId,
        unit: "pcs",
        unitCost: 5,
        unitPrice: 10,
      },
    });
    if (qty > 0) {
      await prisma.inventory.create({
        data: {
          productId: product.id,
          organizationId: t.organizationId,
          quantityOnHand: qty,
          reorderLevel: 10,
        },
      });
    }
    return product;
  };

  const form = (over: Record<string, unknown> = {}) => ({
    saleCode: unique("SO"),
    customerId: t.customerId,
    saleDate: "2026-02-01T00:00:00.000Z",
    status: "Completed",
    items: [{ productId: t.productId, quantity: 1, unitPrice: 10 }],
    ...over,
  });

  const post = (body: Record<string, unknown>, userId: string | null = t.userId) => {
    const req = request(app).post("/api/sales");
    return (userId
      ? req.set(asUser(t.organizationId, userId))
      : req.set(asOrg(t.organizationId))
    ).send(body);
  };

  it("creates the invoice, its lines, the deduction and the ledger together", async () => {
    const product = await stockedProduct(10);
    const code = unique("SO");

    const res = await post(form({ saleCode: code, items: [{ productId: product.id, quantity: 4, unitPrice: 10 }] }));

    expect(res.status).toBe(201);
    expect(res.body.saleCode).toBe(code);
    expect(res.body.items).toHaveLength(1);
    // sum(quantity * unitPrice), with line taxPercent deliberately not counted --
    // it was never part of the legacy browser-side sum.
    expect(res.body.totalAmount).toBe(40);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantityOnHand).toBe(6);

    const logs = await prisma.inventoryLog.findMany({ where: { productId: product.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      movementType: "OUT",
      quantity: 4,
      previousQty: 10,
      newQty: 6,
      reference: code,
    });
  });

  it("refuses to oversell instead of clamping at zero", async () => {
    // The legacy bug. 5 on hand, selling 10: the old service wrote 0 on hand and
    // an OUT of 10 whose ledger said 5 had moved. The document is refused now,
    // and the refusal is total.
    const product = await stockedProduct(5);
    const code = unique("SO");

    const res = await post(
      form({ saleCode: code, items: [{ productId: product.id, quantity: 10, unitPrice: 10 }] })
    );

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(res.body.details.shortages).toEqual([
      { productId: product.id, available: 5, requested: 10 },
    ]);

    // Nothing moved. The stock row is untouched, and there is no invoice and no
    // ledger entry to contradict each other.
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantityOnHand).toBe(5);
    expect(await prisma.sale.findFirst({ where: { saleCode: code } })).toBeNull();
    expect(await prisma.saleItem.count({ where: { sale: { saleCode: code } } })).toBe(0);
    expect(await prisma.inventoryLog.findMany({ where: { reference: code } })).toEqual([]);
  });

  it("refuses a product that has no inventory row at all", async () => {
    // Demand of 0 against no row: the pre-pass reads the missing row as 0
    // available, so this is a shortage rather than a missing-record 409. Pinned
    // because the two are easy to confuse.
    const product = await stockedProduct(0);

    const res = await post(
      form({ items: [{ productId: product.id, quantity: 1, unitPrice: 10 }] })
    );

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await prisma.inventory.findUnique({ where: { productId: product.id } })).toBeNull();
  });

  it("sums repeated lines before checking, and deducts them in sequence", async () => {
    // `demandByProduct` exists so two lines for one product are checked as their
    // sum. 6 + 6 against 10 on hand is a shortage, even though neither line alone
    // is. Both the refusal and the successful variant are worth having: the first
    // proves the lines are summed, the second that sequential deduction still
    // produces two coherent ledger entries.
    const short = await stockedProduct(10);
    const refused = await post(
      form({
        items: [
          { productId: short.id, quantity: 6, unitPrice: 1 },
          { productId: short.id, quantity: 6, unitPrice: 1 },
        ],
      })
    );
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: short.id } })).quantityOnHand
    ).toBe(10);

    const enough = await stockedProduct(10);
    const ok = await post(
      form({
        items: [
          { productId: enough.id, quantity: 6, unitPrice: 1 },
          { productId: enough.id, quantity: 4, unitPrice: 1 },
        ],
      })
    );
    expect(ok.status).toBe(201);

    const logs = await prisma.inventoryLog.findMany({
      where: { productId: enough.id },
      orderBy: { createdAt: "asc" },
    });
    // previousQty - quantity === newQty on each entry, and they chain.
    expect(logs.map((l) => [l.previousQty, l.quantity, l.newQty])).toEqual([
      [10, 6, 4],
      [4, 4, 0],
    ]);
  });

  it("rolls back every write when a late step fails", async () => {
    // `InventoryLog.userId` is a real foreign key and the route only checks that
    // the header is *present*, not that the user exists. So the sale, its lines
    // and the stock deduction are all written, and then the ledger insert trips
    // the constraint. Legacy `addSaleInvoice` ran those as independent statements
    // and would have left an invoice for stock that was never sold.
    const product = await stockedProduct(20);
    const code = unique("SO");

    const res = await post(
      form({ saleCode: code, items: [{ productId: product.id, quantity: 7, unitPrice: 10 }] }),
      "usr_does_not_exist"
    );

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.foreignKey);

    expect(await prisma.sale.findFirst({ where: { saleCode: code } })).toBeNull();
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } })).quantityOnHand
    ).toBe(20);
    expect(await prisma.inventoryLog.findMany({ where: { reference: code } })).toEqual([]);
  });

  it("refuses another tenant's customer and product, leaving their data alone", async () => {
    const foreignCustomer = await post(
      form({ customerId: t.otherCustomerId, items: [{ productId: t.productId, quantity: 1, unitPrice: 1 }] })
    );
    expect(foreignCustomer.status).toBe(400);
    expect(foreignCustomer.body).toMatchObject({ code: "CUSTOMER_NOT_IN_ORGANIZATION" });

    // The other tenant's product is refused too, and the guard is on the write
    // path rather than on the stock, so their inventory is never touched.
    const foreignProduct = await post(
      form({ items: [{ productId: t.otherProductId, quantity: 1, unitPrice: 1 }] })
    );
    expect(foreignProduct.status).toBe(400);
    expect(foreignProduct.body).toMatchObject({ code: "PRODUCT_NOT_IN_ORGANIZATION" });
    expect(
      await prisma.inventory.findUnique({ where: { productId: t.otherProductId } })
    ).toBeNull();
  });

  it("treats saleCode as globally unique, across tenants", async () => {
    const code = unique("SO");
    const product = await stockedProduct(10);

    const first = await post(form({ saleCode: code, items: [{ productId: product.id, quantity: 1, unitPrice: 1 }] }));
    expect(first.status).toBe(201);

    // The second tenant needs a *stocked* product of its own. Without one the
    // pre-check refuses the document as INSUFFICIENT_STOCK before the insert is
    // ever attempted, so the unique index is never reached and the test would be
    // asserting a 409 for the wrong reason -- same status, different code.
    const theirProduct = await prisma.product.create({
      data: {
        productCode: unique("SKU"),
        organizationId: t.otherOrganizationId,
        name: "Their stock",
        categoryId: t.otherCategoryId,
        brandId: t.otherBrandId,
        unit: "pcs",
        unitCost: 1,
        unitPrice: 1,
      },
    });
    await prisma.inventory.create({
      data: {
        productId: theirProduct.id,
        organizationId: t.otherOrganizationId,
        quantityOnHand: 10,
        reorderLevel: 1,
      },
    });

    const second = await request(app)
      .post("/api/sales")
      .set(asUser(t.otherOrganizationId, t.otherUserId))
      .send({
        saleCode: code,
        customerId: t.otherCustomerId,
        saleDate: "2026-02-01T00:00:00.000Z",
        status: "Completed",
        items: [{ productId: theirProduct.id, quantity: 1, unitPrice: 1 }],
      });

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject(errorBody.unique);
  });

  it("rejects a discount past the goods and a negative total", async () => {
    const product = await stockedProduct(10);
    const code = unique("SO");

    const res = await post(
      form({ saleCode: code, discount: 10_000, items: [{ productId: product.id, quantity: 1, unitPrice: 10 }] })
    );

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "INVALID_TOTAL" });
    expect(await prisma.sale.findFirst({ where: { saleCode: code } })).toBeNull();
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } })).quantityOnHand
    ).toBe(10);
  });

  it("requires a user header, because the stock movement has to be attributable", async () => {
    const res = await post(form(), null);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "USER_REQUIRED" });
  });

  it("addresses an invoice by cuid or by saleCode, and scopes both", async () => {
    // The legacy `getSaleInvoiceDetail(saleCode)` had no organization filter, so
    // any tenant could read another tenant's invoice by guessing its code. The
    // union of the two addressing schemes is kept; the scoping is new.
    const product = await stockedProduct(10);
    const created = await post(
      form({ items: [{ productId: product.id, quantity: 1, unitPrice: 10 }] })
    );
    const { id, saleCode } = created.body;

    for (const key of [id, saleCode]) {
      const res = await request(app).get(`/api/sales/${key}`).set(asOrg(t.organizationId));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    }

    const foreign = await request(app)
      .post("/api/sales")
      .set(asUser(t.otherOrganizationId, t.otherUserId))
      .send({
        saleCode: unique("SO"),
        customerId: t.otherCustomerId,
        saleDate: "2026-02-01T00:00:00.000Z",
        status: "Completed",
        items: [{ productId: t.otherProductId, quantity: 1, unitPrice: 1 }],
      });

    // By id and by code: neither leaks.
    for (const key of [foreign.body.id, foreign.body.saleCode]) {
      const res = await request(app).get(`/api/sales/${key}`).set(asOrg(t.organizationId));
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: "SALE_NOT_FOUND" });
    }
  });

  it("sends the lines to the detail route and a count to the list", async () => {
    const product = await stockedProduct(10);
    const created = await post(
      form({ items: [{ productId: product.id, quantity: 1, unitPrice: 10 }] })
    );

    const list = await request(app).get("/api/sales").set(asOrg(t.organizationId));
    const row = list.body.data.find((s: { id: string }) => s.id === created.body.id);
    expect(row._count.items).toBe(1);
    expect(row.items).toBeUndefined();

    const detail = await request(app)
      .get(`/api/sales/${created.body.id}`)
      .set(asOrg(t.organizationId));
    expect(detail.body.items).toHaveLength(1);
    expect(detail.body.items[0].product).toBeTruthy();
  });

  it("refuses to re-point an invoice at another tenant's customer", async () => {
    const product = await stockedProduct(10);
    const created = await post(
      form({ items: [{ productId: product.id, quantity: 1, unitPrice: 10 }] })
    );

    const res = await request(app)
      .put(`/api/sales/${created.body.id}`)
      .set(asOrg(t.organizationId))
      .send({ customerId: t.otherCustomerId });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "CUSTOMER_NOT_IN_ORGANIZATION" });
    expect(
      (await prisma.sale.findUniqueOrThrow({ where: { id: created.body.id } })).customerId
    ).toBe(t.customerId);
  });

  it("leaves the lines and the deducted stock alone on a header-only update", async () => {
    // `SaleUpdateSchema` omits `items`: rewriting lines without replaying the
    // stock movement would put `Inventory.quantityOnHand` out of step with the
    // sale rows. Cancelling left that path too — it is a guarded endpoint now,
    // not a status the PUT can set for itself.
    const product = await stockedProduct(10);
    const created = await post(
      form({ items: [{ productId: product.id, quantity: 3, unitPrice: 10 }] })
    );

    const viaPut = await request(app)
      .put(`/api/sales/${created.body.id}`)
      .set(asOrg(t.organizationId))
      .send({ status: "Cancelled", items: [] });

    expect(viaPut.status).toBe(400);
    expect(viaPut.body).toMatchObject({ code: "USE_CANCEL_ENDPOINT" });

    const res = await request(app)
      .put(`/api/sales/${created.body.id}`)
      .set(asOrg(t.organizationId))
      .send({ status: "Completed", items: [] });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Completed");
    expect(res.body.items).toHaveLength(1);
    // A header edit moves no stock.
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } })).quantityOnHand
    ).toBe(7);

    // The guarded cancel changes the status and remembers where it came from,
    // and it moves no stock either.
    const cancelled = await request(app)
      .post(`/api/sales/${created.body.id}/cancel`)
      .set(asOrg(t.organizationId));

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("Cancelled");
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } })).quantityOnHand
    ).toBe(7);

    const uncancelled = await request(app)
      .post(`/api/sales/${created.body.id}/uncancel`)
      .set(asOrg(t.organizationId));

    expect(uncancelled.status).toBe(200);
    expect(uncancelled.body.status).toBe("Completed");
  });

  it("stamps the invoice, keeps its lines, and returns the stock", async () => {
    const product = await stockedProduct(10);
    const created = await post(
      form({ items: [{ productId: product.id, quantity: 9, unitPrice: 10 }] })
    );
    const id = created.body.id;

    const res = await request(app)
      .delete(`/api/sales/${id}`)
      .set(asUser(t.organizationId, t.userId));
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    // The row and its lines survive for audit; the stamp is what takes the
    // invoice out of circulation.
    const row = await prisma.sale.findUnique({ where: { id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();
    expect(await prisma.saleItem.count({ where: { saleId: id } })).toBe(1);
    // Unlike the legacy delete, the nine units come back.
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } })).quantityOnHand
    ).toBe(10);

    // A stamped invoice is out of every list the client can reach.
    const list = await request(app).get("/api/sales").set(asOrg(t.organizationId));
    expect(list.body.data.some((row: { id: string }) => row.id === id)).toBe(false);

    // Restore puts it back in circulation and takes the stock out again.
    const restored = await request(app)
      .post(`/api/sales/${id}/restore`)
      .set(asUser(t.organizationId, t.userId));
    expect(restored.status).toBe(200);
    expect(restored.body.deletedAt).toBeNull();
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } })).quantityOnHand
    ).toBe(1);
  });

  it("routes /customer/:customerId ahead of /:id and scopes the result", async () => {
    // The legacy `getSaleByCustomer` filtered on `customerId` alone, so a
    // customer id from another tenant returned their whole sales history.
    const product = await stockedProduct(10);
    await post(form({ items: [{ productId: product.id, quantity: 1, unitPrice: 10 }] }));

    const mine = await request(app)
      .get(`/api/sales/customer/${t.customerId}`)
      .set(asOrg(t.organizationId));
    expect(mine.status).toBe(200);
    expect(mine.body.total).toBeGreaterThan(0);

    const theirs = await request(app)
      .get(`/api/sales/customer/${t.otherCustomerId}`)
      .set(asOrg(t.organizationId));
    expect(theirs.status).toBe(200);
    expect(theirs.body.total).toBe(0);
    expect(theirs.body.data).toEqual([]);
  });

  it("filters the list by status", async () => {
    const product = await stockedProduct(10);
    const created = await post(
      form({ status: "Pending", items: [{ productId: product.id, quantity: 1, unitPrice: 10 }] })
    );

    const pending = await request(app)
      .get("/api/sales?status=Pending")
      .set(asOrg(t.organizationId));
    const completed = await request(app)
      .get("/api/sales?status=Completed")
      .set(asOrg(t.organizationId));

    const pendingIds = pending.body.data.map((s: { id: string }) => s.id);
    const completedIds = completed.body.data.map((s: { id: string }) => s.id);
    expect(pendingIds).toContain(created.body.id);
    expect(completedIds).not.toContain(created.body.id);
  });

  it("requires an organization header", async () => {
    const res = await request(app).get("/api/sales");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.organizationRequired);
  });
});

if (!hasDatabase) {
  describe("Checkpoint 2c — database", () => {
    it(`skipped: ${skipReason}`, () => expect(hasDatabase).toBe(false));
  });
}
