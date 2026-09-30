/**
 * Checkpoint 2b — Purchase API: Parity Test
 *
 * Scope: the stock movement. A purchase is the one Checkpoint 2 resource whose
 * create touches four tables in one request, so it is where a real database is
 * worth the setup.
 *
 * `source-review.md` records three bugs in the legacy action, and the parity
 * contract is that all three stay fixed:
 *
 *   1. "No transaction wrapping on create -- partial failure could leave
 *      inconsistent state." This is the suite's centre of gravity: the atomicity
 *      test below forces a failure *after* the first write and asserts nothing
 *      survived. A mocked suite cannot express that assertion at all, because
 *      there is no such thing as a rolled-back mock.
 *   2. "Inventory updates happen in the service layer, not the action."
 *   3. The legacy `addPurchase` hardcoded status "Pending" and dropped the
 *      status the form had selected.
 *
 * On the plan's sample code: `plan.md` shows a `findUnique` then a `update`, and
 * guards the movement with `if (inventory)`. The service does neither. It
 * `upsert`s, so a first purchase for a product creates the stock row instead of
 * silently doing nothing, and it uses `{ increment }` rather than a value
 * computed from a read, because a read-modify-write cannot survive READ
 * COMMITTED. Both are load-bearing enough to pin here.
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

describe.skipIf(!hasDatabase)("Checkpoint 2b — Purchase API", () => {
  let t: Tenant;

  beforeAll(async () => {
    t = await seedTenants();
  });

  afterAll(async () => {
    if (t) await teardownTenants(t);
  });

  const form = (over: Record<string, unknown> = {}) => ({
    supplierId: t.supplierId,
    purchaseCode: unique("PO"),
    purchaseDate: "2026-01-15T00:00:00.000Z",
    status: "Pending",
    items: [{ productId: t.productId, quantity: 5, unitCost: 10 }],
    ...over,
  });

  const post = (body: Record<string, unknown>, userId: string | null = t.userId) => {
    const req = request(app).post("/api/purchases");
    return (userId ? req.set(asUser(t.organizationId, userId)) : req.set(asOrg(t.organizationId))).send(
      body
    );
  };

  it("creates the purchase, its lines, the stock row and the ledger together", async () => {
    const code = unique("PO");
    const res = await post(form({ purchaseCode: code }));

    expect(res.status).toBe(201);
    expect(res.body.purchaseCode).toBe(code);
    expect(res.body.purchaseItems).toHaveLength(1);

    // Recomputed server-side, not trusted from the body: 5 x 10 = 50.
    expect(res.body.totalAmount).toBe(50);
    // Legacy `addPurchase` hardcoded "Pending"; the requested status is stored.
    expect(res.body.status).toBe("Pending");

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productId: t.productId },
    });
    expect(inventory.quantityOnHand).toBe(5);
    expect(inventory.organizationId).toBe(t.organizationId);

    const logs = await prisma.inventoryLog.findMany({ where: { productId: t.productId } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      movementType: "IN",
      quantity: 5,
      previousQty: 0,
      newQty: 5,
      reference: code,
    });
  });

  it("rolls back every write when a late step fails", async () => {
    // The centre of gravity. `InventoryLog.userId` is a real foreign key to User,
    // and the route only checks that the header is *present*, not that the user
    // exists. So a well-formed but unknown x-user-id sails past the route check
    // and every product check, and then the ledger insert fails on the constraint
    // -- after the purchase and the stock increment have already been written.
    //
    // Legacy `addPurchase` ran those as independent statements, so it would leave
    // a purchase receipt for stock that never arrived. The assertion that matters
    // is the second half: the rollback is observable in the tables, not just in
    // the status code. A response of 400 with rows still present would be the bug
    // this checkpoint is about, and only a real database can tell the difference.
    const code = unique("PO");
    const before = await prisma.inventory.findUnique({
      where: { productId: t.productId },
    });

    const res = await post(form({ purchaseCode: code }), "usr_does_not_exist");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.foreignKey);

    // Nothing committed.
    expect(await prisma.purchase.findFirst({ where: { purchaseCode: code } })).toBeNull();
    expect(await prisma.purchaseItem.count({ where: { purchase: { purchaseCode: code } } })).toBe(0);

    const after = await prisma.inventory.findUnique({ where: { productId: t.productId } });
    expect(after?.quantityOnHand).toBe(before?.quantityOnHand ?? 0);

    const logs = await prisma.inventoryLog.findMany({ where: { reference: code } });
    expect(logs).toEqual([]);
  });

  it("refuses a product from another tenant and leaves that tenant's stock alone", async () => {
    // `Inventory.productId` is `@unique` across the whole table, with no
    // organization in the key. The legacy `upsert({ where: { productId } })`
    // would have matched the *other* tenant's inventory row and incremented
    // another company's stock. This is the check that turns that into a 400.
    const res = await post(
      form({ items: [{ productId: t.otherProductId, quantity: 100, unitCost: 1 }] })
    );

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "PRODUCT_NOT_IN_ORGANIZATION" });

    // The other tenant's inventory is untouched. Seeded at 0, and there is no
    // Inventory row for their product unless this bug fires.
    const theirs = await prisma.inventory.findUnique({ where: { productId: t.otherProductId } });
    expect(theirs?.quantityOnHand ?? 0).toBe(0);
  });

  it("creates the stock row on a first purchase rather than skipping the movement", async () => {
    // `plan.md`'s sample guards the movement with `if (inventory)`, so the very
    // first purchase of a product would create a receipt and no stock. The
    // service upserts instead, which is the behaviour a purchase is supposed to
    // have.
    const fresh = await prisma.product.create({
      data: {
        productCode: unique("SKU"),
        organizationId: t.organizationId,
        name: "Never stocked",
        categoryId: t.categoryId,
        brandId: t.brandId,
        unit: "pcs",
        unitCost: 2,
        unitPrice: 4,
      },
    });
    expect(await prisma.inventory.findUnique({ where: { productId: fresh.id } })).toBeNull();

    const res = await post(
      form({ items: [{ productId: fresh.id, quantity: 3, unitCost: 2 }] })
    );
    expect(res.status).toBe(201);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: fresh.id } });
    expect(inventory.quantityOnHand).toBe(3);
  });

  it("accumulates two lines for the same product on one stock row", async () => {
    // The `{ increment }` behaviour, and the reason it is an increment and not a
    // value read earlier: two lines in one document have to add up. Reading once
    // and writing a total would still pass this, so the ledger invariant is the
    // sharper assertion.
    const fresh = await prisma.product.create({
      data: {
        productCode: unique("SKU"),
        organizationId: t.organizationId,
        name: "Two lines",
        categoryId: t.categoryId,
        brandId: t.brandId,
        unit: "pcs",
        unitCost: 1,
        unitPrice: 1,
      },
    });

    const res = await post(
      form({
        items: [
          { productId: fresh.id, quantity: 4, unitCost: 1 },
          { productId: fresh.id, quantity: 6, unitCost: 1 },
        ],
      })
    );
    expect(res.status).toBe(201);
    expect(res.body.purchaseItems).toHaveLength(2);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: fresh.id } });
    expect(inventory.quantityOnHand).toBe(10);

    // previousQty + quantity === newQty, per entry. The service derives
    // previousQty from the row `upsert` just returned rather than from a prior
    // read, so this holds by construction.
    const logs = await prisma.inventoryLog.findMany({
      where: { productId: fresh.id },
      orderBy: { createdAt: "asc" },
    });
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => [l.previousQty, l.quantity, l.newQty])).toEqual([
      [0, 4, 4],
      [4, 6, 10],
    ]);
  });

  it("recomputes the total from the lines and rejects a discount past the goods", async () => {
    const withTax = await post(
      form({
        items: [{ productId: t.productId, quantity: 10, unitCost: 10, itemDiscount: 20, taxPercent: 10 }],
        taxAmount: 5,
      })
    );
    // (10 x 10 - 20) + 10% of (100 - 20) = 80 + 8 = 88, + 5 tax = 93.
    expect(withTax.status).toBe(201);
    expect(withTax.body.totalAmount).toBe(93);

    const code = unique("PO");
    const negative = await post(form({ purchaseCode: code, discount: 10_000 }));
    expect(negative.status).toBe(400);
    expect(negative.body).toMatchObject({ code: "INVALID_TOTAL" });
    expect(await prisma.purchase.findFirst({ where: { purchaseCode: code } })).toBeNull();
  });

  it("requires a user header, because the stock movement has to be attributable", async () => {
    // `InventoryLog.userId` is non-nullable, so the movement cannot be recorded
    // without one. The route checks the header before touching the database.
    const res = await post(form(), null);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "USER_REQUIRED" });
  });

  it("treats purchaseCode as globally unique, across tenants", async () => {
    // `Purchase.purchaseCode` is `@unique` with no organization in the key, so
    // two tenants cannot both use `PO-1000`. Worth pinning: it is a real
    // multi-tenant constraint, not a validation rule, and it only exists in the
    // database.
    const code = unique("PO");
    const first = await request(app)
      .post("/api/purchases")
      .set(asUser(t.organizationId, t.userId))
      .send(form({ purchaseCode: code }));
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/purchases")
      .set(asUser(t.otherOrganizationId, t.otherUserId))
      .send({
        ...form({ purchaseCode: code }),
        supplierId: t.otherSupplierId,
        items: [{ productId: t.otherProductId, quantity: 1, unitCost: 1 }],
      });

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject(errorBody.unique);
  });

  it("sends the lines to the detail route and a count to the list", async () => {
    // An intentional deviation from the legacy list, which embedded every line of
    // every purchase on every row of an unpaginated response.
    const code = unique("PO");
    await post(form({ purchaseCode: code }));

    const list = await request(app).get("/api/purchases").set(asOrg(t.organizationId));
    expect(list.status).toBe(200);
    const row = list.body.data.find((p: { purchaseCode: string }) => p.purchaseCode === code);
    expect(row._count.purchaseItems).toBe(1);
    expect(row.purchaseItems).toBeUndefined();

    const detail = await request(app)
      .get(`/api/purchases/${row.id}`)
      .set(asOrg(t.organizationId));
    expect(detail.body.purchaseItems).toHaveLength(1);
    expect(detail.body.purchaseItems[0].product).toBeTruthy();
  });

  it("404s another tenant's purchase and refuses to re-point one at their supplier", async () => {
    const read = await request(app)
      .get(`/api/purchases/${await otherPurchaseId()}`)
      .set(asOrg(t.organizationId));
    expect(read.status).toBe(404);
    expect(read.body).toMatchObject({ code: "PURCHASE_NOT_FOUND" });

    const mine = await request(app)
      .post("/api/purchases")
      .set(asUser(t.organizationId, t.userId))
      .send(form());
    expect(mine.status).toBe(201);

    const rehome = await request(app)
      .put(`/api/purchases/${mine.body.id}`)
      .set(asOrg(t.organizationId))
      .send({ supplierId: t.otherSupplierId });

    expect(rehome.status).toBe(400);
    expect(rehome.body).toMatchObject({ code: "SUPPLIER_NOT_IN_ORGANIZATION" });

    const unchanged = await prisma.purchase.findUniqueOrThrow({ where: { id: mine.body.id } });
    expect(unchanged.supplierId).toBe(t.supplierId);
  });

  it("leaves the lines alone on a header-only update", async () => {
    // `PurchaseUpdateSchema` omits `items` on purpose: rewriting lines without
    // replaying the stock movement would put `Inventory.quantityOnHand` out of
    // step with the purchase rows.
    const created = await request(app)
      .post("/api/purchases")
      .set(asUser(t.organizationId, t.userId))
      .send(form());
    const id = created.body.id;

    const res = await request(app)
      .put(`/api/purchases/${id}`)
      .set(asOrg(t.organizationId))
      // `items` is not in the update schema, so it is dropped rather than applied.
      .send({ status: "Completed", items: [] });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Completed");
    expect(res.body.purchaseItems).toHaveLength(1);
  });

  it("deletes the purchase and its lines, but does not reverse the stock", async () => {
    // Documented, not accidental: `deletePurchase` removes the receipt and
    // nothing else, matching the legacy action. The quantity stays inflated, so a
    // cancel/reverse flow is still owed. Pinned so the day someone adds the
    // reversal, this test is the one that has to change.
    const fresh = await prisma.product.create({
      data: {
        productCode: unique("SKU"),
        organizationId: t.organizationId,
        name: "To be deleted",
        categoryId: t.categoryId,
        brandId: t.brandId,
        unit: "pcs",
        unitCost: 1,
        unitPrice: 1,
      },
    });

    const created = await request(app)
      .post("/api/purchases")
      .set(asUser(t.organizationId, t.userId))
      .send(form({ items: [{ productId: fresh.id, quantity: 9, unitCost: 1 }] }));
    const id = created.body.id;

    const res = await request(app)
      .delete(`/api/purchases/${id}`)
      .set(asOrg(t.organizationId));
    expect(res.status).toBe(204);

    expect(await prisma.purchase.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.purchaseItem.count({ where: { purchaseId: id } })).toBe(0);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: fresh.id } });
    expect(inventory.quantityOnHand).toBe(9);
  });

  it("routes /supplier/:supplierId ahead of /:id", async () => {
    // Route ordering. Mounted the other way round, "supplier" is parsed as a
    // purchase id and the answer is 404 PURCHASE_NOT_FOUND.
    const res = await request(app)
      .get(`/api/purchases/supplier/${t.supplierId}`)
      .set(asOrg(t.organizationId));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((p: { supplierId: string }) => p.supplierId === t.supplierId)).toBe(true);
  });

  it("requires an organization header", async () => {
    const res = await request(app).get("/api/purchases");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.organizationRequired);
  });

  /** A purchase belonging to the second tenant, for the cross-tenant reads. */
  async function otherPurchaseId(): Promise<string> {
    const res = await request(app)
      .post("/api/purchases")
      .set(asUser(t.otherOrganizationId, t.otherUserId))
      .send({
        supplierId: t.otherSupplierId,
        purchaseCode: unique("PO"),
        purchaseDate: "2026-01-15T00:00:00.000Z",
        status: "Pending",
        items: [{ productId: t.otherProductId, quantity: 1, unitCost: 1 }],
      });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }
});

if (!hasDatabase) {
  describe("Checkpoint 2b — database", () => {
    it(`skipped: ${skipReason}`, () => expect(hasDatabase).toBe(false));
  });
}
