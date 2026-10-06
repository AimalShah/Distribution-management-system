/**
 * Checkpoint 2e — Return API: Parity Test
 *
 * Scope: the return service, which is the one place in the codebase where the
 * database is the only thing enforcing a business rule.
 *
 * **1. `Serializable` and the cumulative total.** A SALE or PURCHASE return is held
 * to the document it reverses: what is being returned now, plus everything already
 * returned against that document, cannot exceed what the document moved. That total
 * is a sum over *other rows*, so a read-then-write pair cannot hold it under READ
 * COMMITTED — two returns of one unit against a one unit sale both read a prior
 * total of zero, both pass, and both write, putting two units of stock on hand that
 * never arrived. The create therefore runs at `Serializable`, and a conflict aborts
 * one of the two with P2034, which the error handler turns into a 409 the caller can
 * retry. There is no mock equivalent of this: a mocked transaction is a function
 * that returns whatever it was told to, and "the database aborted one of these" is
 * not a thing a mock can be told.
 *
 * **2. Delete has to put the stock back.** Every return this service creates moves
 * stock, so a delete that only removed the row would leave a SALE return's goods on
 * hand forever, and would silently take a PURCHASE or write-off's deduction back out
 * of the ledger. The reversal is written as its own ledger rows rather than by
 * editing or deleting the originals, so the log shows the movement out and the
 * movement back. Reversing a SALE return is a *decrease*, which is guarded like any
 * other: if the returned goods have since been sold on, the reversal is refused and
 * the return row survives, because the whole reversal is one transaction.
 *
 * **3. The document links.** `Return.saleId`/`.purchaseId` are columns the legacy
 * form already collected and the legacy service already discarded, so nothing held a
 * return to the document it claimed to reverse. They exist now, and the service
 * writes them *from the return type* rather than from the payload, so the two columns
 * cannot disagree with `returnType` even if a caller slips a field past the schema's
 * `superRefine`.
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

describe.skipIf(!hasDatabase)("Checkpoint 2e — Return API", () => {
  let t: Tenant;
  /** A second member of the caller's own org, for the ledger attribution test. */
  let colleagueId: string;

  beforeAll(async () => {
    t = await seedTenants();
    colleagueId = `usr_parity_${unique("mate")}`;
    await prisma.user.create({
      data: {
        id: colleagueId,
        name: "Second Operator",
        email: `${colleagueId}@parity.invalid`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: t.organizationId,
        role: "member",
      },
    });
  });

  afterAll(async () => {
    if (colleagueId) {
      await prisma.inventoryLog.deleteMany({ where: { userId: colleagueId } });
      await prisma.user.deleteMany({ where: { id: colleagueId } });
    }
    if (t) await teardownTenants(t);
  });

  const makeProduct = (org = t.organizationId) =>
    prisma.product.create({
      data: {
        productCode: unique("SKU"),
        organizationId: org,
        name: "Returnable item",
        categoryId: org === t.organizationId ? t.categoryId : t.otherCategoryId,
        brandId: org === t.organizationId ? t.brandId : t.otherBrandId,
        unit: "pcs",
        unitCost: 1,
        unitPrice: 10,
      },
    });

  const stock = (productId: string, quantityOnHand: number, org = t.organizationId) =>
    prisma.inventory.create({
      data: { productId, organizationId: org, quantityOnHand, reorderLevel: 1 },
    });

  /** A stocked product, ready to be sold or bought. */
  const stockedProduct = async (quantityOnHand: number, org = t.organizationId) => {
    const p = await makeProduct(org);
    const row = await stock(p.id, quantityOnHand, org);
    return { product: p, row };
  };

  const makeSale = async (
    lines: { productId: string; quantity: number }[],
    org = t.organizationId
  ) => {
    const sale = await prisma.sale.create({
      data: {
        saleCode: unique("SO"),
        organizationId: org,
        customerId: org === t.organizationId ? t.customerId : t.otherCustomerId,
        totalAmount: lines.reduce((sum, l) => sum + l.quantity * 10, 0),
        status: "Completed",
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: 10,
            totalPrice: l.quantity * 10,
          })),
        },
      },
    });
    return sale;
  };

  const makePurchase = async (
    lines: { productId: string; quantity: number }[],
    org = t.organizationId
  ) => {
    const purchase = await prisma.purchase.create({
      data: {
        purchaseCode: unique("PO"),
        organizationId: org,
        supplierId: org === t.organizationId ? t.supplierId : t.otherSupplierId,
        totalAmount: lines.reduce((sum, l) => sum + l.quantity, 0),
        status: "Completed",
        purchaseItems: {
          create: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitCost: 1,
            totalCost: l.quantity,
          })),
        },
      },
    });
    return purchase;
  };

  const line = (productId: string, quantity: number) => ({
    productId,
    quantity,
    unitPrice: 10,
    taxAmount: 0,
    discount: 0,
  });

  const post = (body: Record<string, unknown>, userId: string | null = t.userId) => {
    const req = request(app).post("/api/returns").send(body);
    return userId ? req.set(asUser(t.organizationId, userId)) : req.set(asOrg(t.organizationId));
  };

  const onHand = async (productId: string) =>
    (await prisma.inventory.findUniqueOrThrow({ where: { productId } })).quantityOnHand;

  const logsFor = (productId: string) =>
    prisma.inventoryLog.findMany({
      where: { productId },
      orderBy: { createdAt: "asc" },
      select: {
        movementType: true,
        quantity: true,
        previousQty: true,
        newQty: true,
        reason: true,
        reference: true,
        userId: true,
      },
    });

  it("brings stock back in for a SALE return", async () => {
    // A customer handing goods back is the one return type whose direction is IN.
    // The legacy `addReturn` moved no stock at all in any direction; the
    // `source-review.md` shipped with this checkpoint claimed otherwise, and that
    // claim was the only trace of the behaviour anywhere in the codebase.
    const { product } = await stockedProduct(5);
    const sale = await makeSale([{ productId: product.id, quantity: 2 }]);
    const code = unique("RTN");

    const res = await post({
      returnCode: code,
      returnType: "SALE",
      saleId: sale.id,
      reason: "wrong size",
      items: [line(product.id, 2)],
    });

    expect(res.status).toBe(201);
    expect(await onHand(product.id)).toBe(7);
    expect(await logsFor(product.id)).toEqual([
      {
        movementType: "RETURN",
        quantity: 2,
        previousQty: 5,
        newQty: 7,
        reason: `Sale return ${code}: wrong size`,
        reference: code,
        userId: t.userId,
      },
    ]);
  });

  it.each([
    ["PURCHASE", "OUT"],
    ["EXPIRED", "EXPIRED"],
    ["DAMAGED", "DAMAGED"],
  ] as const)("takes stock out for a %s return, logging %s", async (returnType, movement) => {
    // Everything else is stock leaving the building. The ledger value is the same
    // four types `services/inventory.ts` classifies, so a reconciliation does not
    // have to special-case returns.
    const { product } = await stockedProduct(10);

    const body: Record<string, unknown> = {
      returnCode: unique("RTN"),
      returnType,
      reason: "going back",
      items: [line(product.id, 3)],
    };

    if (returnType === "PURCHASE") {
      body.purchaseId = (await makePurchase([{ productId: product.id, quantity: 5 }])).id;
    }

    const res = await post(body);

    expect(res.status).toBe(201);
    expect(await onHand(product.id)).toBe(7);
    const [entry] = await logsFor(product.id);
    expect(entry).toMatchObject({ movementType: movement, quantity: 3, previousQty: 10, newQty: 7 });
  });

  it("writes the document link from the return type, and only that one", async () => {
    // The columns are set from `returnType`, not from the payload, so they cannot
    // disagree with it. The legacy service wrote neither column at all.
    const { product } = await stockedProduct(10);
    const purchase = await makePurchase([{ productId: product.id, quantity: 5 }]);
    const code = unique("RTN");

    const res = await post({
      returnCode: code,
      returnType: "PURCHASE",
      purchaseId: purchase.id,
      items: [line(product.id, 1)],
    });

    expect(res.status).toBe(201);
    expect(res.body.purchaseId).toBe(purchase.id);
    expect(res.body.saleId).toBeNull();
    // The detail route carries the linked document's code, so a row can say what
    // the return is reversing without a second request per row.
    expect(res.body.purchase).toMatchObject({ purchaseCode: purchase.purchaseCode });
    expect(res.body.sale).toBeNull();
  });

  it("aggregates repeated lines of one product into a single movement", async () => {
    // The demand map is keyed by product, so two lines of three units are one
    // movement of six and one ledger row — not two movements the log would read as
    // separate events.
    const { product } = await stockedProduct(10);

    const res = await post({
      returnCode: unique("RTN"),
      returnType: "DAMAGED",
      reason: "crushed in transit",
      items: [line(product.id, 3), line(product.id, 3)],
    });

    expect(res.status).toBe(201);
    expect(await onHand(product.id)).toBe(4);
    expect(await logsFor(product.id)).toHaveLength(1);
    expect((await logsFor(product.id))[0]).toMatchObject({ quantity: 6, previousQty: 10, newQty: 4 });
  });

  it("refuses a product that was never on the document", async () => {
    const { product: onIt } = await stockedProduct(10);
    const { product: notOnIt } = await stockedProduct(10);
    const sale = await makeSale([{ productId: onIt.id, quantity: 2 }]);

    const res = await post({
      returnCode: unique("RTN"),
      returnType: "SALE",
      saleId: sale.id,
      items: [line(notOnIt.id, 1)],
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "PRODUCT_NOT_ON_DOCUMENT" });
    expect(res.body.details.productIds).toEqual([notOnIt.id]);
    expect(await onHand(notOnIt.id)).toBe(10);
    // Scoped to this document: other tests in this file have posted SALE returns.
    expect(await prisma.return.count({ where: { saleId: sale.id } })).toBe(0);
  });

  it("counts what earlier returns already took off the document", async () => {
    // The point of the sale link. Without the cumulative rule a four unit sale
    // could be returned three units at a time, four times over, and put sixteen
    // units of stock on hand.
    const { product } = await stockedProduct(20);
    const sale = await makeSale([{ productId: product.id, quantity: 4 }]);

    const first = await post({
      returnCode: unique("RTN"),
      returnType: "SALE",
      saleId: sale.id,
      items: [line(product.id, 3)],
    });
    expect(first.status).toBe(201);
    expect(await onHand(product.id)).toBe(23);

    const second = await post({
      returnCode: unique("RTN"),
      returnType: "SALE",
      saleId: sale.id,
      items: [line(product.id, 2)],
    });

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({ code: "RETURN_EXCEEDS_DOCUMENT" });
    expect(second.body.details.overReturned).toEqual([
      { productId: product.id, available: 1, requested: 2 },
    ]);
    expect(await onHand(product.id)).toBe(23);
  });

  it("lets two concurrent returns against the same document settle at one", async () => {
    // The one assertion in this suite that no mocked test could ever make. Both
    // requests read a prior total of zero and both pass the check, because under
    // SERIALIZABLE the second is not *told* it is wrong — the database aborts it.
    //
    // The outcome of the loser depends on timing and is deliberately not pinned:
    // it may be aborted as a write conflict, or it may read the winner's committed
    // row and fail the quantity check. Both are 409 and both are correct. What is
    // pinned is the invariant — one unit of stock in, one return on file.
    const { product } = await stockedProduct(5);
    const sale = await makeSale([{ productId: product.id, quantity: 1 }]);

    const body = (code: string) => ({
      returnCode: code,
      returnType: "SALE",
      saleId: sale.id,
      items: [line(product.id, 1)],
    });

    const [a, b] = await Promise.all([
      post(body(unique("RTN"))),
      post(body(unique("RTN"))),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const loser = a.status === 409 ? a : b;
    expect(["WRITE_CONFLICT", "RETURN_EXCEEDS_DOCUMENT"]).toContain(loser.body.code);

    expect(await onHand(product.id)).toBe(6);
    expect(await prisma.return.count({ where: { saleId: sale.id } })).toBe(1);
    expect(await prisma.inventoryLog.count({ where: { productId: product.id } })).toBe(1);
  });

  it("refuses another tenant's product, and writes nothing", async () => {
    // `ReturnItem.productId` is a plain foreign key with no organization
    // constraint, so the database would happily return another tenant's goods and
    // move its stock. This check is the only thing standing in the way.
    const res = await post({
      returnCode: unique("RTN"),
      returnType: "DAMAGED",
      items: [line(t.otherProductId, 1)],
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "PRODUCT_NOT_IN_ORGANIZATION" });
    expect(res.body.details.productIds).toEqual([t.otherProductId]);
    expect(await prisma.returnItem.count({ where: { productId: t.otherProductId } })).toBe(0);
    expect(
      await prisma.inventoryLog.count({ where: { productId: t.otherProductId } })
    ).toBe(0);
  });

  it("refuses another tenant's sale as the document being reversed", async () => {
    const theirs = await makeSale(
      [{ productId: t.otherProductId, quantity: 2 }],
      t.otherOrganizationId
    );

    const res = await post({
      returnCode: unique("RTN"),
      returnType: "SALE",
      saleId: theirs.id,
      items: [line(t.productId, 1)],
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "SALE_NOT_IN_ORGANIZATION" });
    expect(await prisma.return.count({ where: { saleId: theirs.id } })).toBe(0);
  });

  it("refuses another tenant's purchase as the document being reversed", async () => {
    const theirs = await makePurchase(
      [{ productId: t.otherProductId, quantity: 2 }],
      t.otherOrganizationId
    );

    const res = await post({
      returnCode: unique("RTN"),
      returnType: "PURCHASE",
      purchaseId: theirs.id,
      items: [line(t.productId, 1)],
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "PURCHASE_NOT_IN_ORGANIZATION" });
  });

  it("409s a product that has no stock record to move", async () => {
    const orphan = await makeProduct();

    const res = await post({
      returnCode: unique("RTN"),
      returnType: "DAMAGED",
      items: [line(orphan.id, 1)],
    });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "INVENTORY_ROW_MISSING" });
    expect(res.body.details.productIds).toEqual([orphan.id]);
  });

  it("409s an outbound return larger than the stock, and writes nothing", async () => {
    // The whole return fails rather than the offending line: a write-off that took
    // one product and could not take another is not a write-off.
    const { product: plenty } = await stockedProduct(10);
    const { product: short } = await stockedProduct(1);

    const res = await post({
      returnCode: unique("RTN"),
      returnType: "EXPIRED",
      reason: "past the date",
      items: [line(plenty.id, 1), line(short.id, 5)],
    });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(res.body.details.shortages).toEqual([
      { productId: short.id, available: 1, requested: 5 },
    ]);
    expect(await onHand(plenty.id)).toBe(10);
    expect(await onHand(short.id)).toBe(1);
    expect(await prisma.return.count({ where: { reason: "past the date" } })).toBe(0);
  });

  it("puts the stock back when a SALE return is deleted", async () => {
    // The reversal is written as its own ledger rows, not by editing the original:
    // the return did happen, and a reader is meant to see it go out and come back.
    const { product } = await stockedProduct(5);
    const sale = await makeSale([{ productId: product.id, quantity: 2 }]);
    const code = unique("RTN");

    const created = await post({
      returnCode: code,
      returnType: "SALE",
      saleId: sale.id,
      items: [line(product.id, 2)],
    });
    expect(created.status).toBe(201);
    expect(await onHand(product.id)).toBe(7);

    const res = await request(app)
      .delete(`/api/returns/${created.body.id}`)
      .set(asUser(t.organizationId, t.userId));

    expect(res.status).toBe(200);
    expect(await onHand(product.id)).toBe(5);

    // Out and back, and the pair reads as one movement each way.
    const entries = await logsFor(product.id);
    expect(entries.map((e) => [e.movementType, e.quantity, e.previousQty, e.newQty])).toEqual([
      ["RETURN", 2, 5, 7],
      ["OUT", 2, 7, 5],
    ]);
    expect(entries[1].reason).toBe(`Reversal of return ${code}`);
    expect(entries[1].reference).toBe(code);
  });

  it("restores stock for a write-off delete, in the other direction", async () => {
    const { product } = await stockedProduct(10);

    const created = await post({
      returnCode: unique("RTN"),
      returnType: "DAMAGED",
      items: [line(product.id, 3)],
    });
    expect(await onHand(product.id)).toBe(7);

    await request(app)
      .delete(`/api/returns/${created.body.id}`)
      .set(asUser(t.organizationId, t.userId));

    expect(await onHand(product.id)).toBe(10);
    const entries = await logsFor(product.id);
    // The reversal of a DAMAGED is a RETURN, so the pair reads as one movement out
    // and one back whichever way round the return went.
    expect(entries.map((e) => e.movementType)).toEqual(["DAMAGED", "RETURN"]);
  });

  it("refuses to delete a return whose goods have been sold on", async () => {
    // Reversing a SALE return is a decrease, so it is guarded like any other. The
    // legacy `deleteReturn` had no stock handling at all, so this could not happen.
    const { product } = await stockedProduct(5);
    const sale = await makeSale([{ productId: product.id, quantity: 5 }]);

    const created = await post({
      returnCode: unique("RTN"),
      returnType: "SALE",
      saleId: sale.id,
      items: [line(product.id, 5)],
    });
    expect(await onHand(product.id)).toBe(10);

    // Someone sells the returned goods straight back out.
    await prisma.inventory.update({
      where: { productId: product.id },
      data: { quantityOnHand: 2 },
    });

    const res = await request(app)
      .delete(`/api/returns/${created.body.id}`)
      .set(asUser(t.organizationId, t.userId));

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "INSUFFICIENT_STOCK_FOR_REVERSAL" });
    expect(res.body.details).toMatchObject({ available: 2, requested: 5 });

    // The refusal is inside the transaction, so the return is still on file and the
    // stock is untouched.
    expect(await prisma.return.count({ where: { id: created.body.id } })).toBe(1);
    expect(await onHand(product.id)).toBe(2);
  });

  it("attributes the reversal to the member deleting, not the one who recorded it", async () => {
    // The ledger answers who moved the stock, and the member who took the goods
    // back out is not necessarily the member who recorded the return going in.
    const { product } = await stockedProduct(5);
    const sale = await makeSale([{ productId: product.id, quantity: 2 }]);

    const created = await post({
      returnCode: unique("RTN"),
      returnType: "SALE",
      saleId: sale.id,
      items: [line(product.id, 2)],
    });
    expect(created.body.userId).toBe(t.userId);

    await request(app)
      .delete(`/api/returns/${created.body.id}`)
      .set(asUser(t.organizationId, colleagueId));

    const entries = await logsFor(product.id);
    expect(entries.map((e) => e.userId)).toEqual([t.userId, colleagueId]);
  });

  it("stamps the return and keeps its lines, taking it out of circulation", async () => {
    const { product } = await stockedProduct(10);
    const created = await post({
      returnCode: unique("RTN"),
      returnType: "DAMAGED",
      items: [line(product.id, 1)],
    });

    expect(await prisma.returnItem.count({ where: { returnId: created.body.id } })).toBe(1);

    const res = await request(app)
      .delete(`/api/returns/${created.body.id}`)
      .set(asUser(t.organizationId, t.userId));

    expect(res.status).toBe(200);

    // The legacy delete removed both rows. The correction keeps them — the
    // stamp is what takes the return out of circulation — and the stock the
    // write-off took has already gone back (asserted above).
    const row = await prisma.return.findUnique({ where: { id: created.body.id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();
    expect(await prisma.returnItem.count({ where: { returnId: created.body.id } })).toBe(1);

    // Gone from the list the client sees...
    const list = await request(app).get("/api/returns").set(asUser(t.organizationId, t.userId));
    expect(list.body.data.some((r: { id: string }) => r.id === created.body.id)).toBe(false);

    // ...and back in circulation on restore, which puts the stock back out.
    const restored = await request(app)
      .post(`/api/returns/${created.body.id}/restore`)
      .set(asUser(t.organizationId, t.userId));
    expect(restored.status).toBe(200);
    expect(restored.body.deletedAt).toBeNull();
  });

  it("treats returnCode as globally unique, across tenants", async () => {
    const { product } = await stockedProduct(5);
    const code = unique("RTN");

    const first = await post({
      returnCode: code,
      returnType: "DAMAGED",
      items: [line(product.id, 1)],
    });
    expect(first.status).toBe(201);

    // The other tenant needs a *stocked* product of its own. Without one the
    // service refuses the document as INVENTORY_ROW_MISSING before the insert is
    // attempted, so the unique index is never reached and the test would be
    // asserting a 409 for the wrong reason.
    const theirs = await stockedProduct(5, t.otherOrganizationId);

    const second = await request(app)
      .post("/api/returns")
      .set(asUser(t.otherOrganizationId, t.otherUserId))
      .send({
        returnCode: code,
        returnType: "DAMAGED",
        items: [line(theirs.product.id, 1)],
      });

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject(errorBody.unique);
  });

  it("reads a return by id or by code", async () => {
    const { product } = await stockedProduct(10);
    const code = unique("RTN");
    const created = await post({
      returnCode: code,
      returnType: "DAMAGED",
      items: [line(product.id, 1)],
    });

    for (const key of [created.body.id, code]) {
      const res = await request(app).get(`/api/returns/${key}`).set(asOrg(t.organizationId));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
    }
  });

  it("404s a return belonging to another tenant, by id and by code", async () => {
    // The legacy `fetchReturn` was `findMany({ where: { id } })` with no
    // organization filter *and returned an array* for a detail route, so it leaked
    // any tenant's return to anyone who could guess an id.
    const { product } = await stockedProduct(10, t.otherOrganizationId);
    const code = unique("RTN");
    const theirs = await prisma.return.create({
      data: {
        returnCode: code,
        organizationId: t.otherOrganizationId,
        returnType: "DAMAGED",
        userId: t.otherUserId,
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: 1,
            taxAmount: 0,
            discount: 0,
          },
        },
      },
    });

    for (const key of [theirs.id, code]) {
      const res = await request(app).get(`/api/returns/${key}`).set(asOrg(t.organizationId));
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: "RETURN_NOT_FOUND" });
      // A detail route returns the record, not a list holding it.
      expect(Array.isArray(res.body)).toBe(false);
    }
  });

  it("edits the header columns and refuses the rest", async () => {
    // `returnType` decides the direction of the stock movement and `saleId` is
    // what the returned quantity is checked against, so both are immutable. The
    // legacy `Partial<ReturnFormData>` allowed exactly this, and it is how a return
    // came to be relabelled from a customer handback to a write-off with the ledger
    // still recording the stock coming back in.
    const { product } = await stockedProduct(10);
    const sale = await makeSale([{ productId: product.id, quantity: 2 }]);
    const created = await post({
      returnCode: unique("RTN"),
      returnType: "SALE",
      saleId: sale.id,
      reason: "wrong size",
      items: [line(product.id, 1)],
    });

    for (const body of [
      { returnType: "DAMAGED" },
      { items: [line(product.id, 2)] },
      { saleId: "sle_another" },
      { purchaseId: "po_another" },
    ]) {
      const res = await request(app)
        .put(`/api/returns/${created.body.id}`)
        .set(asOrg(t.organizationId))
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject(errorBody.validation);
    }

    // The header itself is editable, and the stock is untouched by doing so.
    const ok = await request(app)
      .put(`/api/returns/${created.body.id}`)
      .set(asOrg(t.organizationId))
      .send({ reason: "wrong colour too" });

    expect(ok.status).toBe(200);
    expect(ok.body.reason).toBe("wrong colour too");
    expect(ok.body.returnType).toBe("SALE");
    expect(await onHand(product.id)).toBe(11);
  });

  it("404s an update or delete against another tenant's return", async () => {
    const { product } = await stockedProduct(10, t.otherOrganizationId);
    const theirs = await prisma.return.create({
      data: {
        returnCode: unique("RTN"),
        organizationId: t.otherOrganizationId,
        returnType: "DAMAGED",
        userId: t.otherUserId,
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: 1,
            taxAmount: 0,
            discount: 0,
          },
        },
      },
    });

    const update = await request(app)
      .put(`/api/returns/${theirs.id}`)
      .set(asOrg(t.organizationId))
      .send({ reason: "mine now" });
    expect(update.status).toBe(404);

    const remove = await request(app)
      .delete(`/api/returns/${theirs.id}`)
      .set(asUser(t.organizationId, t.userId));
    expect(remove.status).toBe(404);

    // Their stock and their return both survive.
    expect(await prisma.return.count({ where: { id: theirs.id } })).toBe(1);
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } })).quantityOnHand
    ).toBe(10);
  });

  it("filters the list by type and search, inside the tenant", async () => {
    const { product: damagedItem } = await stockedProduct(10);
    const { product: expiredItem } = await stockedProduct(10);
    const mine = unique("RTN");
    const expiredCode = unique("RTN");

    await post({ returnCode: mine, returnType: "DAMAGED", items: [line(damagedItem.id, 1)] });
    await post({ returnCode: expiredCode, returnType: "EXPIRED", items: [line(expiredItem.id, 1)] });
    await prisma.return.create({
      data: {
        returnCode: unique("RTN"),
        organizationId: t.otherOrganizationId,
        returnType: "DAMAGED",
        userId: t.otherUserId,
        items: {
          create: {
            productId: t.otherProductId,
            quantity: 1,
            unitPrice: 1,
            taxAmount: 0,
            discount: 0,
          },
        },
      },
    });

    const all = await request(app).get("/api/returns").set(asOrg(t.organizationId));
    expect(all.status).toBe(200);
    const codes = all.body.data.map((r: { returnCode: string }) => r.returnCode);
    expect(codes).toContain(mine);
    expect(codes).toContain(expiredCode);
    // Another tenant's rows are not in the list at all.
    expect(
      all.body.data.every((r: { organizationId: string }) => r.organizationId === t.organizationId)
    ).toBe(true);
    // The list counts the lines instead of embedding them.
    expect(all.body.data[0]).toHaveProperty("_count.items");
    expect(all.body.data[0].items).toBeUndefined();

    // The filter is exact rather than approximate: this file's earlier cases have
    // posted other EXPIRED returns, so the assertion is that every row matches and
    // the one under test is among them -- not that it is the only one.
    const byType = await request(app)
      .get("/api/returns?returnType=EXPIRED")
      .set(asOrg(t.organizationId));
    const expired = byType.body.data as { returnCode: string; returnType: string }[];
    expect(expired.length).toBeGreaterThan(0);
    expect(expired.every((r) => r.returnType === "EXPIRED")).toBe(true);
    expect(expired.map((r) => r.returnCode)).toContain(expiredCode);
    expect(expired.map((r) => r.returnCode)).not.toContain(mine);

    const bySearch = await request(app)
      .get(`/api/returns?search=${mine}`)
      .set(asOrg(t.organizationId));
    expect(bySearch.body.data.map((r: { returnCode: string }) => r.returnCode)).toEqual([mine]);
  });

  it("requires a user header on both write routes", async () => {
    // Every return writes at least one `InventoryLog`, whose `userId` is required.
    const { product } = await stockedProduct(10);
    const sale = await makeSale([{ productId: product.id, quantity: 2 }]);

    const created = await prisma.return.create({
      data: {
        returnCode: unique("RTN"),
        organizationId: t.organizationId,
        returnType: "DAMAGED",
        userId: t.userId,
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: 1,
            taxAmount: 0,
            discount: 0,
          },
        },
      },
    });

    const postRes = await post(
      { returnCode: unique("RTN"), returnType: "DAMAGED", items: [line(product.id, 1)] },
      null
    );
    expect(postRes.status).toBe(400);
    expect(postRes.body).toMatchObject({ code: "USER_REQUIRED" });

    const deleteRes = await request(app)
      .delete(`/api/returns/${created.id}`)
      .set(asOrg(t.organizationId));
    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body).toMatchObject({ code: "USER_REQUIRED" });

    // Nothing moved and nothing was deleted.
    expect(await onHand(product.id)).toBe(10);
    expect(await prisma.return.count({ where: { id: created.id } })).toBe(1);
  });

  it("refuses a document link that disagrees with the return type", async () => {
    // A DAMAGED return naming a sale would be accepted and then dropped, which is
    // the other half of the gap the legacy `.refine()` left open.
    const { product } = await stockedProduct(10);
    const sale = await makeSale([{ productId: product.id, quantity: 2 }]);

    const res = await post({
      returnCode: unique("RTN"),
      returnType: "DAMAGED",
      saleId: sale.id,
      items: [line(product.id, 1)],
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.validation);
    expect(await onHand(product.id)).toBe(10);
  });

  it("requires an organization header", async () => {
    const res = await request(app).get("/api/returns");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.organizationRequired);
  });
});

if (!hasDatabase) {
  describe("Checkpoint 2e — database", () => {
    it(`skipped: ${skipReason}`, () => expect(hasDatabase).toBe(false));
  });
}
