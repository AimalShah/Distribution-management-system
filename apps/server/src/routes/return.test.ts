import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER, USER_HEADER } from "../middleware/auth-context";

const { models, transaction } = vi.hoisted(() => {
  const models = {
    return: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    product: { findMany: vi.fn(), findFirst: vi.fn() },
    sale: { findFirst: vi.fn() },
    purchase: { findFirst: vi.fn() },
    inventory: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    inventoryLog: { create: vi.fn() },
  };

  // `$transaction` receives an interactive callback: the real client hands it a
  // transaction-scoped client, so the callback has to be invoked with the same
  // model mocks and its result has to be awaited. The options are part of the
  // signature so a test can assert the isolation level the service asked for.
  const transaction = vi.fn(
    async (
      callback: (tx: typeof models) => Promise<unknown>,
      _options?: { isolationLevel?: string }
    ) => callback(models)
  );

  return { models, transaction };
});

vi.mock("@dms/db", () => ({
  default: { ...models, $transaction: transaction },
  prisma: { ...models, $transaction: transaction },
}));

const app = createApp();

const ORG = "org_1";
const USER = "user_1";

const auth = (withUser = true) => ({
  [ORGANIZATION_HEADER]: ORG,
  ...(withUser ? { [USER_HEADER]: USER } : {}),
});

const returnFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "ret_1",
  returnCode: "RET-001",
  organizationId: ORG,
  returnType: "SALE",
  returnDate: new Date("2026-02-01T00:00:00.000Z"),
  reason: "Damaged box",
  userId: USER,
  saleId: "sale_1",
  purchaseId: null,
  createdAt: new Date("2026-02-01T00:00:00.000Z"),
  updatedAt: new Date("2026-02-01T00:00:00.000Z"),
  user: { name: "Ada", email: "ada@example.com" },
  _count: { items: 1 },
  items: [
    {
      id: "rit_1",
      productId: "prod_1",
      quantity: 2,
      unitPrice: 10,
      taxAmount: 0,
      discount: 0,
      note: null,
      product: { id: "prod_1", name: "Widget" },
    },
  ],
  sale: { id: "sale_1", saleCode: "SAL-001" },
  purchase: null,
  ...overrides,
});

const saleFixture = (items = [{ productId: "prod_1", quantity: 5 }]) => ({
  saleCode: "SAL-001",
  items,
});

const purchaseFixture = (items = [{ productId: "prod_1", quantity: 8 }]) => ({
  purchaseCode: "PUR-001",
  purchaseItems: items,
});

const inventoryRow = (overrides: Record<string, unknown> = {}) => ({
  id: "inv_1",
  productId: "prod_1",
  quantityOnHand: 10,
  ...overrides,
});

const line = (overrides: Record<string, unknown> = {}) => ({
  productId: "prod_1",
  quantity: 2,
  unitPrice: 10,
  taxAmount: 0,
  discount: 0,
  ...overrides,
});

/** A SALE return, which is the direction that puts stock back on hand. */
const saleReturn = (overrides: Record<string, unknown> = {}) => ({
  returnCode: "RET-001",
  returnType: "SALE",
  saleId: "sale_1",
  reason: "Damaged box",
  items: [line()],
  ...overrides,
});

/** A PURCHASE return, which is the direction that takes stock off hand. */
const purchaseReturn = (overrides: Record<string, unknown> = {}) => ({
  returnCode: "RET-002",
  returnType: "PURCHASE",
  purchaseId: "pur_1",
  items: [line()],
  ...overrides,
});

/** The data the service passed to `return.create`. */
const createArg = () =>
  models.return.create.mock.calls[0][0] as { data: Record<string, unknown> };

/** The data the service passed to the `InventoryLog` for one product. */
const logArg = (index = 0) =>
  models.inventoryLog.create.mock.calls[index][0] as { data: Record<string, unknown> };

beforeEach(() => {
  vi.clearAllMocks();

  models.return.findFirst.mockResolvedValue(returnFixture());
  models.return.findMany.mockResolvedValue([]);
  models.return.count.mockResolvedValue(1);
  models.return.create.mockResolvedValue(returnFixture());
  models.return.update.mockResolvedValue(returnFixture());
  models.return.delete.mockResolvedValue(returnFixture());

  models.product.findMany.mockResolvedValue([{ id: "prod_1" }]);
  models.sale.findFirst.mockResolvedValue(saleFixture());
  models.purchase.findFirst.mockResolvedValue(purchaseFixture());

  models.inventory.findMany.mockResolvedValue([inventoryRow()]);
  models.inventory.findFirst.mockResolvedValue(inventoryRow());
  // The guarded decrement claimed the units and left 8 on hand.
  models.inventory.updateMany.mockResolvedValue({ count: 1 });
  models.inventory.findFirstOrThrow.mockResolvedValue({ quantityOnHand: 8 });
  // The atomic increment put 2 onto 10.
  models.inventory.update.mockResolvedValue({ quantityOnHand: 12 });

  models.inventoryLog.create.mockResolvedValue({});
});

describe("organization context", () => {
  it("rejects a request without an organization and never touches the database", async () => {
    const res = await request(app).get("/api/returns");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(models.return.findMany).not.toHaveBeenCalled();
  });

  it("scopes the list to the caller's organization", async () => {
    await request(app).get("/api/returns").set(auth());

    expect(models.return.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG, deletedAt: null } })
    );
  });
});

describe("GET /api/returns", () => {
  it("returns a paginated envelope newest first", async () => {
    models.return.count.mockResolvedValue(21);

    const res = await request(app).get("/api/returns").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(21);
    expect(res.body.pageCount).toBe(2);
    expect(models.return.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { returnDate: "desc" },
      })
    );
  });

  it("counts the lines instead of embedding every one of them", async () => {
    await request(app).get("/api/returns").set(auth());

    const arg = models.return.findMany.mock.calls[0][0] as {
      include: Record<string, unknown>;
    };
    expect(arg.include).toHaveProperty("_count");
    expect(arg.include).not.toHaveProperty("items");
  });

  it("filters by type and ignores an empty search box", async () => {
    await request(app).get("/api/returns?returnType=DAMAGED&search=ret-1").set(auth());
    expect(models.return.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          deletedAt: null,
          returnType: "DAMAGED",
          returnCode: { contains: "ret-1", mode: "insensitive" },
        },
      })
    );

    await request(app).get("/api/returns?search=").set(auth());
    expect(models.return.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { organizationId: ORG, deletedAt: null } })
    );
  });

  it("rejects a bad page", async () => {
    const res = await request(app).get("/api/returns?page=0").set(auth());

    expect(res.status).toBe(400);
    expect(models.return.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/returns/:id", () => {
  it("scopes the lookup and accepts an id or a return code", async () => {
    const res = await request(app).get("/api/returns/ret_1").set(auth());

    expect(res.status).toBe(200);
    expect(models.return.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          OR: [{ id: "ret_1" }, { returnCode: "ret_1" }],
        },
      })
    );
  });

  it("embeds the lines and the linked document's code", async () => {
    await request(app).get("/api/returns/RET-001").set(auth());

    const arg = models.return.findFirst.mock.calls[0][0] as {
      include: Record<string, unknown>;
    };
    expect(arg.include).toHaveProperty("items");
    expect(arg.include).toHaveProperty("sale");
    expect(arg.include).toHaveProperty("purchase");
  });

  // The legacy detail route was `findMany({ where: { id } })` with no tenant
  // filter, so it returned an array holding any tenant's return.
  it("404s instead of reading another tenant's return", async () => {
    models.return.findFirst.mockResolvedValue(null);

    const res = await request(app).get("/api/returns/ret_foreign").set(auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RETURN_NOT_FOUND");
  });
});

describe("POST /api/returns validation", () => {
  it("requires a sale for a SALE return", async () => {
    const res = await request(app)
      .post("/api/returns")
      .set(auth())
      .send(saleReturn({ saleId: undefined }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details.fieldErrors.saleId).toBeDefined();
    expect(models.return.create).not.toHaveBeenCalled();
  });

  it("requires a purchase for a PURCHASE return", async () => {
    const res = await request(app)
      .post("/api/returns")
      .set(auth())
      .send(purchaseReturn({ purchaseId: undefined }));

    expect(res.status).toBe(400);
    expect(res.body.details.fieldErrors.purchaseId).toBeDefined();
    expect(models.return.create).not.toHaveBeenCalled();
  });

  // The legacy `.refine()` only checked the field it wanted and ignored the
  // other one, so a DAMAGED return could name a sale, pass, and be dropped.
  it("refuses a document reference the return type does not take", async () => {
    const res = await request(app)
      .post("/api/returns")
      .set(auth())
      .send(saleReturn({ returnType: "DAMAGED" }));

    expect(res.status).toBe(400);
    expect(res.body.details.fieldErrors.saleId).toBeDefined();
    expect(models.return.create).not.toHaveBeenCalled();
  });

  it("refuses a purchase reference on a SALE return", async () => {
    const res = await request(app)
      .post("/api/returns")
      .set(auth())
      .send(saleReturn({ purchaseId: "pur_1" }));

    expect(res.status).toBe(400);
    expect(res.body.details.fieldErrors.purchaseId).toBeDefined();
  });

  it("refuses a return with no lines", async () => {
    const res = await request(app)
      .post("/api/returns")
      .set(auth())
      .send(saleReturn({ items: [] }));

    expect(res.status).toBe(400);
    expect(models.return.create).not.toHaveBeenCalled();
  });

  it("refuses a return code shorter than three characters", async () => {
    const res = await request(app)
      .post("/api/returns")
      .set(auth())
      .send(saleReturn({ returnCode: "RE" }));

    expect(res.status).toBe(400);
  });

  it("refuses a return with no user to attribute the stock movement to", async () => {
    const res = await request(app).post("/api/returns").set(auth(false)).send(saleReturn());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(models.return.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/returns for a SALE", () => {
  it("puts the stock back with a single atomic increment", async () => {
    const res = await request(app).post("/api/returns").set(auth()).send(saleReturn());

    expect(res.status).toBe(201);
    expect(models.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_1", organizationId: ORG },
        data: { quantityOnHand: { increment: 2 } },
      })
    );
    // An increase is never a read-then-write, so the guarded decrement is not
    // consulted for this direction.
    expect(models.inventory.updateMany).not.toHaveBeenCalled();
  });

  it("logs a RETURN movement whose figures add up", async () => {
    await request(app).post("/api/returns").set(auth()).send(saleReturn());

    const data = logArg().data as {
      movementType: string;
      quantity: number;
      previousQty: number;
      newQty: number;
      userId: string;
      reference: string;
      reason: string;
      inventoryId: string;
      productId: string;
    };

    expect(data.movementType).toBe("RETURN");
    expect(data.previousQty).toBe(10);
    expect(data.newQty).toBe(12);
    // An inbound movement adds, so the ledger's arithmetic is previous + qty.
    expect(data.previousQty + data.quantity).toBe(data.newQty);
    expect(data.userId).toBe(USER);
    expect(data.inventoryId).toBe("inv_1");
    expect(data.productId).toBe("prod_1");
    expect(data.reference).toBe("RET-001");
    expect(data.reason).toContain("RET-001");
    expect(data.reason).toContain("Damaged box");
  });

  it("links the sale and leaves the purchase link null", async () => {
    await request(app).post("/api/returns").set(auth()).send(saleReturn());

    expect(createArg().data).toMatchObject({
      saleId: "sale_1",
      purchaseId: null,
      organizationId: ORG,
      userId: USER,
    });
  });

  it("opens the transaction at Serializable", async () => {
    await request(app).post("/api/returns").set(auth()).send(saleReturn());

    expect(transaction.mock.calls[0][1]).toEqual({ isolationLevel: "Serializable" });
  });

  it("refuses a product from another organization", async () => {
    models.product.findMany.mockResolvedValue([]);

    const res = await request(app).post("/api/returns").set(auth()).send(saleReturn());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PRODUCT_NOT_IN_ORGANIZATION");
    expect(models.return.create).not.toHaveBeenCalled();
  });

  it("refuses a sale from another organization", async () => {
    models.sale.findFirst.mockResolvedValue(null);

    const res = await request(app).post("/api/returns").set(auth()).send(saleReturn());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SALE_NOT_IN_ORGANIZATION");
    expect(models.return.create).not.toHaveBeenCalled();
  });

  it("refuses a product that is not on the sale", async () => {
    models.sale.findFirst.mockResolvedValue(saleFixture([{ productId: "prod_2", quantity: 5 }]));

    const res = await request(app).post("/api/returns").set(auth()).send(saleReturn());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PRODUCT_NOT_ON_DOCUMENT");
    expect(res.body.details.productIds).toEqual(["prod_1"]);
    expect(models.return.create).not.toHaveBeenCalled();
  });

  it("refuses more than the sale moved", async () => {
    models.sale.findFirst.mockResolvedValue(saleFixture([{ productId: "prod_1", quantity: 1 }]));

    const res = await request(app).post("/api/returns").set(auth()).send(saleReturn());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("RETURN_EXCEEDS_DOCUMENT");
    expect(res.body.details.overReturned).toEqual([
      { productId: "prod_1", available: 1, requested: 2 },
    ]);
    expect(models.return.create).not.toHaveBeenCalled();
  });

  it("subtracts what earlier returns already took off the sale", async () => {
    models.return.findMany.mockResolvedValue([
      { items: [{ productId: "prod_1", quantity: 4 }] },
    ]);

    // 5 on the sale, 4 already returned, so 2 more is one too many.
    const res = await request(app).post("/api/returns").set(auth()).send(saleReturn());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("RETURN_EXCEEDS_DOCUMENT");
    expect(res.body.details.overReturned[0].available).toBe(1);
  });

  it("allows the remainder of the sale", async () => {
    models.return.findMany.mockResolvedValue([
      { items: [{ productId: "prod_1", quantity: 3 }] },
    ]);

    const res = await request(app).post("/api/returns").set(auth()).send(saleReturn());

    expect(res.status).toBe(201);
  });

  it("refuses a product with no stock record", async () => {
    models.inventory.findMany.mockResolvedValue([]);

    const res = await request(app).post("/api/returns").set(auth()).send(saleReturn());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVENTORY_ROW_MISSING");
    expect(res.body.details.productIds).toEqual(["prod_1"]);
  });

  it("adds up repeated lines for one product before moving stock", async () => {
    models.product.findMany.mockResolvedValue([{ id: "prod_1" }]);
    models.sale.findFirst.mockResolvedValue(saleFixture([{ productId: "prod_1", quantity: 10 }]));

    await request(app)
      .post("/api/returns")
      .set(auth())
      .send(saleReturn({ items: [line({ quantity: 1 }), line({ quantity: 1 })] }));

    expect(models.inventory.update).toHaveBeenCalledTimes(1);
    expect(models.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantityOnHand: { increment: 2 } } })
    );
  });
});

describe("POST /api/returns that takes stock off hand", () => {
  it.each(["PURCHASE", "DAMAGED", "EXPIRED"])(
    "guards the decrement for a %s return",
    async (returnType) => {
      const body =
        returnType === "PURCHASE"
          ? purchaseReturn()
          : saleReturn({ returnType, saleId: undefined });

      const res = await request(app).post("/api/returns").set(auth()).send(body);

      expect(res.status).toBe(201);
      expect(models.inventory.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "inv_1",
            organizationId: ORG,
            quantityOnHand: { gte: 2 },
          },
          data: { quantityOnHand: { decrement: 2 } },
        })
      );
      expect(models.inventory.update).not.toHaveBeenCalled();
    }
  );

  it("logs a movement whose figures subtract down", async () => {
    await request(app)
      .post("/api/returns")
      .set(auth())
      .send(purchaseReturn());

    const data = logArg().data as {
      movementType: string;
      quantity: number;
      previousQty: number;
      newQty: number;
      reference: string;
    };

    expect(data.movementType).toBe("OUT");
    expect(data.previousQty).toBe(10);
    expect(data.newQty).toBe(8);
    // An outbound movement subtracts, so the ledger's arithmetic is previous - qty.
    expect(data.previousQty - data.quantity).toBe(data.newQty);
    expect(data.reference).toBe("RET-002");
  });

  it("labels the write-off movements by type", async () => {
    await request(app)
      .post("/api/returns")
      .set(auth())
      .send(saleReturn({ returnType: "DAMAGED", saleId: undefined }));

    expect((logArg().data as { movementType: string }).movementType).toBe("DAMAGED");
  });

  it("checks the return against the purchase it reverses", async () => {
    await request(app)
      .post("/api/returns")
      .set(auth())
      .send(purchaseReturn());

    expect(models.purchase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pur_1", organizationId: ORG } })
    );
    expect(models.return.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { purchaseId: "pur_1", organizationId: ORG, deletedAt: null },
      })
    );
  });

  it("refuses a purchase from another organization", async () => {
    models.purchase.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/returns")
      .set(auth())
      .send(purchaseReturn());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PURCHASE_NOT_IN_ORGANIZATION");
  });

  it("refuses more than the purchase received", async () => {
    models.purchase.findFirst.mockResolvedValue(
      purchaseFixture([{ productId: "prod_1", quantity: 1 }])
    );

    const res = await request(app)
      .post("/api/returns")
      .set(auth())
      .send(purchaseReturn());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("RETURN_EXCEEDS_DOCUMENT");
  });

  it("refuses to take more stock than is on hand", async () => {
    // 5 fits the 8 unit purchase, but only 3 are on hand, so the shortage is the
    // thing that refuses it rather than the document check above.
    models.inventory.findMany.mockResolvedValue([inventoryRow({ quantityOnHand: 3 })]);

    const res = await request(app)
      .post("/api/returns")
      .set(auth())
      .send(purchaseReturn({ items: [line({ quantity: 5 })] }));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STOCK");
    expect(res.body.details.shortages).toEqual([
      { productId: "prod_1", available: 3, requested: 5 },
    ]);
    expect(models.return.create).not.toHaveBeenCalled();
  });

  it("reports a lost race on the guarded write as a shortage, not a missing row", async () => {
    // The pre-pass saw enough, then a concurrent transaction took the units.
    models.inventory.updateMany.mockResolvedValue({ count: 0 });
    models.inventory.findFirst.mockResolvedValue(inventoryRow({ quantityOnHand: 1 }));

    const res = await request(app)
      .post("/api/returns")
      .set(auth())
      .send(purchaseReturn());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STOCK");
    expect(res.body.details).toEqual({ available: 1, requested: 2 });
  });

  it("tells a deleted stock row apart from a shortage", async () => {
    models.inventory.updateMany.mockResolvedValue({ count: 0 });
    models.inventory.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/returns")
      .set(auth())
      .send(purchaseReturn());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVENTORY_ROW_MISSING");
  });
});

describe("write conflicts", () => {
  it("reports a serializable conflict as a retryable 409", async () => {
    transaction.mockRejectedValueOnce({
      code: "P2034",
      name: "PrismaClientKnownRequestError",
    });

    const res = await request(app).post("/api/returns").set(auth()).send(saleReturn());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("WRITE_CONFLICT");
  });
});

describe("PUT /api/returns/:id", () => {
  it("updates the header scoped to the organization", async () => {
    const res = await request(app)
      .put("/api/returns/ret_1")
      .set(auth())
      .send({ returnCode: "RET-900", reason: "Opened again" });

    expect(res.status).toBe(200);
    expect(models.return.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ret_1", organizationId: ORG },
        data: { returnCode: "RET-900", reason: "Opened again" },
      })
    );
  });

  // `updateReturn` used to accept a new `returnType` freely, so a return could be
  // relabelled from a customer handback to a write-off while the ledger still
  // recorded the stock coming back in.
  it("refuses to relabel the return type", async () => {
    const res = await request(app)
      .put("/api/returns/ret_1")
      .set(auth())
      .send({ returnType: "DAMAGED" });

    expect(res.status).toBe(400);
    expect(models.return.update).not.toHaveBeenCalled();
  });

  it("refuses to rewrite the lines or the document links", async () => {
    for (const body of [{ items: [line()] }, { saleId: "sale_2" }, { purchaseId: "pur_2" }]) {
      const res = await request(app).put("/api/returns/ret_1").set(auth()).send(body);
      expect(res.status).toBe(400);
    }

    expect(models.return.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/returns/:id", () => {
  it("takes the goods back off hand when a SALE return is deleted", async () => {
    const res = await request(app).delete("/api/returns/ret_1").set(auth());

    expect(res.status).toBe(200);
    expect(models.inventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_1", organizationId: ORG, quantityOnHand: { gte: 2 } },
        data: { quantityOnHand: { decrement: 2 } },
      })
    );

    const data = logArg().data as {
      movementType: string;
      previousQty: number;
      newQty: number;
      quantity: number;
      reason: string;
      reference: string;
    };
    expect(data.movementType).toBe("OUT");
    expect(data.previousQty).toBe(10);
    expect(data.newQty).toBe(8);
    expect(data.previousQty - data.quantity).toBe(data.newQty);
    expect(data.reason).toContain("RET-001");
    expect(data.reference).toBe("RET-001");
  });

  it("puts the goods back on hand when a write-off return is deleted", async () => {
    models.return.findFirst.mockResolvedValue(
      returnFixture({ returnType: "DAMAGED", saleId: null, purchaseId: null })
    );

    const res = await request(app).delete("/api/returns/ret_1").set(auth());

    expect(res.status).toBe(200);
    expect(models.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantityOnHand: { increment: 2 } } })
    );
    expect((logArg().data as { movementType: string }).movementType).toBe("RETURN");
  });

  // The reversal answers who moved the stock, which is the member deleting the
  // return rather than the member who recorded it.
  it("attributes the reversal to whoever performed the delete", async () => {
    models.return.findFirst.mockResolvedValue(returnFixture({ userId: "user_other" }));

    await request(app).delete("/api/returns/ret_1").set(auth());

    expect((logArg().data as { userId: string }).userId).toBe(USER);
  });

  it("refuses a reversal the stock on hand cannot cover", async () => {
    models.inventory.updateMany.mockResolvedValue({ count: 0 });
    models.inventory.findFirst.mockResolvedValue(inventoryRow({ quantityOnHand: 1 }));

    const res = await request(app).delete("/api/returns/ret_1").set(auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STOCK_FOR_REVERSAL");
    expect(models.return.delete).not.toHaveBeenCalled();
  });

  it("404s instead of reversing another tenant's return", async () => {
    models.return.findFirst.mockResolvedValue(null);

    const res = await request(app).delete("/api/returns/ret_foreign").set(auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RETURN_NOT_FOUND");
    expect(models.inventory.update).not.toHaveBeenCalled();
    expect(models.return.delete).not.toHaveBeenCalled();
  });

  it("refuses a delete with no user to attribute the reversal to", async () => {
    const res = await request(app).delete("/api/returns/ret_1").set(auth(false));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(models.return.delete).not.toHaveBeenCalled();
  });
});
