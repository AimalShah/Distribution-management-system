import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER, USER_ENV_VAR, USER_HEADER } from "../middleware/auth-context";

const { models, transaction } = vi.hoisted(() => {
  const models = {
    member: { findFirst: async () => ({ role: "owner" }) },
    purchase: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    product: { findMany: vi.fn() },
    supplier: { findFirst: vi.fn() },
    inventory: { upsert: vi.fn() },
    inventoryLog: { create: vi.fn() },
    stockBatch: { upsert: vi.fn() },
  };

  // `$transaction` receives an interactive callback: the real client hands it a
  // transaction-scoped client, so the callback has to be invoked with the same
  // model mocks and its result has to be awaited.
  const transaction = vi.fn(
    async (callback: (tx: typeof models) => Promise<unknown>) => callback(models)
  );

  return { models, transaction };
});

vi.mock("@dms/db", () => ({
  default: { ...models, $transaction: transaction },
  prisma: { ...models, $transaction: transaction },
}));

const app = createApp();

const ORG = "org_1";

const OTHER_ORG = "org_2";

const USER = "user_1";

const auth = () => ({
  [ORGANIZATION_HEADER]: ORG,
  [USER_HEADER]: USER,
});

const supplier = { id: "sup_1", companyName: "Acme Supplies" };

const purchaseItem = (overrides: Record<string, unknown> = {}) => ({
  id: "pi_1",
  purchaseId: "pur_1",
  productId: "prod_1",
  quantity: 10,
  unitCost: 5,
  totalCost: 50,
  batchNumber: null,
  expiryDate: null,
  taxPercent: null,
  discount: null,
  product: { id: "prod_1", name: "Widget", unit: "pcs" },
  ...overrides,
});

const purchaseFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "pur_1",
  purchaseCode: "PO-001",
  organizationId: ORG,
  supplierId: "sup_1",
  totalAmount: 50,
  taxAmount: null,
  discount: null,
  status: "Pending",
  purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  supplier,
  purchaseItems: [purchaseItem()],
  _count: { purchaseItems: 1 },
  ...overrides,
});

const validBody = {
  supplierId: "sup_1",
  purchaseCode: "PO-001",
  purchaseDate: "2026-01-01",
  status: "Pending",
  items: [{ productId: "prod_1", quantity: 10, unitCost: 5 }],
};

const prismaError = (code: string, meta?: Record<string, unknown>) => ({
  code,
  meta,
  name: "PrismaClientKnownRequestError",
});

beforeEach(() => {
  vi.clearAllMocks();
  models.purchase.findMany.mockResolvedValue([purchaseFixture()]);
  models.purchase.count.mockResolvedValue(1);
  models.purchase.findFirst.mockResolvedValue(purchaseFixture());
  models.purchase.create.mockResolvedValue(purchaseFixture());
  models.purchase.update.mockResolvedValue(purchaseFixture());
  models.purchase.delete.mockResolvedValue(purchaseFixture());
  models.product.findMany.mockResolvedValue([{ id: "prod_1" }]);
  models.supplier.findFirst.mockResolvedValue({ id: "sup_1" });
  // `upsert` returns the row as it stands after the statement, which is what the
  // service derives the log's previousQty from.
  models.inventory.upsert.mockResolvedValue({ id: "inv_1", quantityOnHand: 15 });
  models.inventoryLog.create.mockResolvedValue({ id: "log_1" });
});

describe("organization context", () => {
  it("rejects a request without an organization and never touches the database", async () => {
    const res = await request(app).get("/api/purchases");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(models.purchase.findMany).not.toHaveBeenCalled();
  });

  it("scopes the list to the caller's organization", async () => {
    await request(app).get("/api/purchases").set(auth());

    expect(models.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });
});

describe("GET /api/purchases", () => {
  it("returns a paginated envelope with default paging", async () => {
    models.purchase.count.mockResolvedValue(42);

    const res = await request(app).get("/api/purchases").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(42);
    expect(res.body.pageCount).toBe(3);
    expect(res.body.data).toHaveLength(1);
    expect(models.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
  });

  it("computes skip from page and pageSize", async () => {
    await request(app).get("/api/purchases?page=3&pageSize=5").set(auth());

    expect(models.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 })
    );
  });

  it("orders by purchase date descending", async () => {
    await request(app).get("/api/purchases").set(auth());

    expect(models.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { purchaseDate: "desc" } })
    );
  });

  it("searches by purchase code and treats an empty box as no filter", async () => {
    await request(app).get("/api/purchases?search=po-00").set(auth());
    expect(models.purchase.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          purchaseCode: { contains: "po-00", mode: "insensitive" },
        },
      })
    );

    await request(app).get("/api/purchases?search=").set(auth());
    expect(models.purchase.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });

  it("counts the item rows instead of embedding them on the list", async () => {
    await request(app).get("/api/purchases").set(auth());

    const arg = models.purchase.findMany.mock.calls[0][0] as {
      include: Record<string, unknown>;
    };

    expect(arg.include).toHaveProperty("_count");
    expect(arg.include).not.toHaveProperty("purchaseItems");
  });

  it("rejects an out of range page", async () => {
    const res = await request(app).get("/api/purchases?page=0").set(auth());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(models.purchase.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/purchases/supplier/:supplierId", () => {
  // The replacement for the unbounded `purchase: true` embed the supplier detail
  // route used to carry. Mirrors `GET /api/sales/customer/:customerId`.

  it("pages the supplier's purchases", async () => {
    models.purchase.count.mockResolvedValue(42);

    const res = await request(app)
      .get("/api/purchases/supplier/sup_1?page=2&pageSize=5")
      .set(auth());

    expect(res.status).toBe(200);
    expect(models.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supplierId: "sup_1", organizationId: ORG },
        skip: 5,
        take: 5,
      })
    );
    // 42 purchases at 5 a page is 9 pages, and the total comes back with them so
    // a caller can page without guessing.
    expect(res.body.pageCount).toBe(9);
    expect(res.body.total).toBe(42);
  });

  it("scopes the page to the tenant as well as the supplier", async () => {
    // Without organizationId a supplier id from another tenant would answer with
    // this tenant's -- or, since ids are guessable, another tenant's purchases.
    await request(app)
      .get("/api/purchases/supplier/sup_1")
      .set(auth());

    expect(models.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supplierId: "sup_1", organizationId: ORG },
      })
    );
    expect(models.purchase.count).toHaveBeenCalledWith({
      where: { supplierId: "sup_1", organizationId: ORG },
    });
  });

  it("is not shadowed by /:id", async () => {
    // Registered ahead of the `/:id` route, so the literal segment wins and
    // "supplier" is never read as a purchase id.
    const res = await request(app)
      .get("/api/purchases/supplier/sup_1")
      .set(auth());

    expect(res.status).toBe(200);
    expect(models.purchase.findFirst).not.toHaveBeenCalled();
  });
});

describe("GET /api/purchases/:id", () => {
  it("returns one purchase with supplier and lines", async () => {
    const res = await request(app).get("/api/purchases/pur_1").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("pur_1");
    expect(res.body.purchaseItems).toHaveLength(1);
    expect(models.purchase.findFirst).toHaveBeenCalledWith({
      where: { id: "pur_1", organizationId: ORG },
      include: { supplier: true, purchaseItems: { include: { product: true } } },
    });
  });

  it("404s instead of returning a list like the legacy findMany did", async () => {
    models.purchase.findFirst.mockResolvedValue(null);

    const res = await request(app).get("/api/purchases/missing").set(auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PURCHASE_NOT_FOUND");
  });
});

describe("POST /api/purchases", () => {
  it("creates the purchase, moves stock in and logs the movement", async () => {
    const res = await request(app).post("/api/purchases").set(auth()).send(validBody);

    expect(res.status).toBe(201);
    expect(transaction).toHaveBeenCalledTimes(1);

    expect(models.purchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purchaseCode: "PO-001",
          organizationId: ORG,
          status: "Pending",
          totalAmount: 50,
          purchaseItems: {
            create: [
              expect.objectContaining({
                productId: "prod_1",
                quantity: 10,
                unitCost: 5,
                totalCost: 50,
              }),
            ],
          },
        }),
      })
    );

    expect(models.inventory.upsert).toHaveBeenCalledWith({
      where: { productId: "prod_1" },
      update: { quantityOnHand: { increment: 10 } },
      create: expect.anything(),
    });

    expect(models.inventoryLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inventoryId: "inv_1",
        productId: "prod_1",
        userId: USER,
        movementType: "IN",
        quantity: 10,
        previousQty: 5,
        newQty: 15,
        reference: "PO-001",
      }),
    });
  });

  it("computes the total server side from the legacy form's formula", async () => {
    const res = await request(app)
      .post("/api/purchases")
      .set(auth())
      .send({
        ...validBody,
        discount: 5,
        taxAmount: 10,
        items: [
          { productId: "prod_1", quantity: 10, unitCost: 5, itemDiscount: 2, taxPercent: 10 },
        ],
      });

    expect(res.status).toBe(201);

    // 10*5 = 50, less 2 item discount, plus 10% of 48, then -5 +10 header amounts.
    const arg = models.purchase.create.mock.calls[0][0] as {
      data: { totalAmount: number; purchaseItems: { create: { totalCost: number }[] } };
    };

    expect(arg.data.totalAmount).toBeCloseTo(57.8, 5);
    expect(arg.data.purchaseItems.create[0].totalCost).toBe(50);
  });

  it("refuses a discount that drives the total negative", async () => {
    const res = await request(app)
      .post("/api/purchases")
      .set(auth())
      .send({ ...validBody, discount: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_TOTAL");
    expect(models.purchase.create).not.toHaveBeenCalled();
    expect(models.inventory.upsert).not.toHaveBeenCalled();
  });

  it("rejects products that belong to another organization before writing", async () => {
    models.product.findMany.mockResolvedValue([{ id: "prod_1" }]);

    const res = await request(app)
      .post("/api/purchases")
      .set(auth())
      .send({
        ...validBody,
        items: [
          { productId: "prod_1", quantity: 1, unitCost: 1 },
          { productId: "prod_foreign", quantity: 1, unitCost: 1 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PRODUCT_NOT_IN_ORGANIZATION");
    expect(res.body.details).toEqual({ productIds: ["prod_foreign"] });
    expect(models.purchase.create).not.toHaveBeenCalled();
    expect(models.inventory.upsert).not.toHaveBeenCalled();
    expect(models.inventoryLog.create).not.toHaveBeenCalled();
  });

  it("creates the inventory row when the product has none yet", async () => {
    // The row is created at `quantityOnHand: 10`, and `upsert` hands that back.
    models.inventory.upsert.mockResolvedValue({ id: "inv_1", quantityOnHand: 10 });

    await request(app).post("/api/purchases").set(auth()).send(validBody);

    expect(models.inventory.upsert).toHaveBeenCalledWith({
      where: { productId: "prod_1" },
      update: { quantityOnHand: { increment: 10 } },
      create: expect.objectContaining({
        productId: "prod_1",
        organizationId: ORG,
        quantityOnHand: 10,
      }),
    });
    expect(models.inventoryLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ previousQty: 0, newQty: 10 }),
    });
  });

  it("accumulates two lines for the same product", async () => {
    // Each line increments the same row, so the second `upsert` returns 19.
    models.inventory.upsert
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 15 })
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 19 });

    await request(app)
      .post("/api/purchases")
      .set(auth())
      .send({
        ...validBody,
        items: [
          { productId: "prod_1", quantity: 10, unitCost: 5, batchNumber: "B1" },
          { productId: "prod_1", quantity: 4, unitCost: 5, batchNumber: "B2" },
        ],
      });

    expect(models.inventoryLog.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ previousQty: 5, newQty: 15 }),
    });
    expect(models.inventoryLog.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ previousQty: 15, newQty: 19 }),
    });
  });

  it("leaves the increment to the database instead of writing an absolute quantity", async () => {
    await request(app).post("/api/purchases").set(auth()).send(validBody);

    // A read-modify-write cannot hold under READ COMMITTED: two concurrent
    // purchases would both read 5, both write 15, and 20 units received would be
    // recorded as 10. `{ increment }` is one statement against the row it
    // updates, so the database serialises it.
    const arg = models.inventory.upsert.mock.calls[0][0] as {
      update: { quantityOnHand: unknown };
    };

    expect(arg.update.quantityOnHand).toEqual({ increment: 10 });
  });

  it("deduplicates the tenant check when a product repeats", async () => {
    await request(app)
      .post("/api/purchases")
      .set(auth())
      .send({
        ...validBody,
        items: [
          { productId: "prod_1", quantity: 1, unitCost: 1 },
          { productId: "prod_1", quantity: 2, unitCost: 1 },
        ],
      });

    expect(models.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["prod_1"] }, organizationId: ORG },
      select: { id: true },
    });
  });

  it("requires a user id to attribute the inventory log", async () => {
    vi.stubEnv(USER_ENV_VAR, "");

    const res = await request(app)
      .post("/api/purchases")
      .set({ [ORGANIZATION_HEADER]: ORG })
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(models.purchase.create).not.toHaveBeenCalled();
    expect(models.inventoryLog.create).not.toHaveBeenCalled();
  });

  it("treats blank optional fields from the legacy form as absent", async () => {
    await request(app)
      .post("/api/purchases")
      .set(auth())
      .send({
        ...validBody,
        items: [
          {
            productId: "prod_1",
            quantity: 1,
            unitCost: 5,
            batchNumber: "",
            expiryDate: "",
            taxPercent: 0,
            itemDiscount: 0,
          },
        ],
      });

    const arg = models.purchase.create.mock.calls[0][0] as {
      data: { purchaseItems: { create: Record<string, unknown>[] } };
    };

    expect(arg.data.purchaseItems.create[0]).toMatchObject({
      batchNumber: undefined,
      expiryDate: undefined,
      taxPercent: 0,
      discount: 0,
    });
  });

  it("parses an ISO date into a real Date", async () => {
    await request(app).post("/api/purchases").set(auth()).send(validBody);

    expect(models.purchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
        }),
      })
    );
  });

  it("rejects an unparseable purchase date", async () => {
    const res = await request(app)
      .post("/api/purchases")
      .set(auth())
      .send({ ...validBody, purchaseDate: "not-a-date" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(models.purchase.create).not.toHaveBeenCalled();
  });

  it("rejects a null purchase date instead of storing the epoch", async () => {
    const res = await request(app)
      .post("/api/purchases")
      .set(auth())
      .send({ ...validBody, purchaseDate: null });

    expect(res.status).toBe(400);
    expect(models.purchase.create).not.toHaveBeenCalled();
  });

  it("rejects a purchase with no items", async () => {
    const res = await request(app)
      .post("/api/purchases")
      .set(auth())
      .send({ ...validBody, items: [] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a fractional quantity and a tax percent above 100", async () => {
    const fractional = await request(app)
      .post("/api/purchases")
      .set(auth())
      .send({ ...validBody, items: [{ productId: "prod_1", quantity: 1.5, unitCost: 1 }] });

    const overTax = await request(app)
      .post("/api/purchases")
      .set(auth())
      .send({
        ...validBody,
        items: [{ productId: "prod_1", quantity: 1, unitCost: 1, taxPercent: 101 }],
      });

    expect(fractional.status).toBe(400);
    expect(overTax.status).toBe(400);
    expect(models.purchase.create).not.toHaveBeenCalled();
  });

  it("maps a duplicate purchase code to a conflict", async () => {
    models.purchase.create.mockRejectedValue(
      prismaError("P2002", { target: ["purchaseCode"] })
    );

    const res = await request(app).post("/api/purchases").set(auth()).send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIQUE_CONSTRAINT");
  });

  it("surfaces a failed inventory log instead of leaving a silent gap", async () => {
    models.inventoryLog.create.mockRejectedValue(prismaError("P2003"));

    const res = await request(app).post("/api/purchases").set(auth()).send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("FOREIGN_KEY_VIOLATION");
  });
});

describe("PUT /api/purchases/:id", () => {
  it("updates header columns scoped to the organization", async () => {
    const res = await request(app)
      .put("/api/purchases/pur_1")
      .set(auth())
      .send({ status: "Completed", purchaseDate: "2026-02-01" });

    expect(res.status).toBe(200);
    expect(models.purchase.update).toHaveBeenCalledWith({
      where: { id: "pur_1", organizationId: ORG },
      data: { status: "Completed", purchaseDate: new Date("2026-02-01T00:00:00.000Z") },
      include: { supplier: true, purchaseItems: { include: { product: true } } },
    });
  });

  it("ignores items rather than rewriting lines without a stock movement", async () => {
    await request(app)
      .put("/api/purchases/pur_1")
      .set(auth())
      .send({ status: "Pending", items: [{ productId: "prod_1", quantity: 9, unitCost: 9 }] });

    const arg = models.purchase.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data).toEqual({ status: "Pending" });
    expect(models.inventory.upsert).not.toHaveBeenCalled();
  });

  it("does not accept a client supplied total", async () => {
    await request(app)
      .put("/api/purchases/pur_1")
      .set(auth())
      .send({ totalAmount: 999999 });

    const arg = models.purchase.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data).toEqual({});
  });

  it("refuses to re-point the purchase at another tenant's supplier", async () => {
    models.supplier.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .put("/api/purchases/pur_1")
      .set(auth())
      .send({ supplierId: "sup_foreign" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SUPPLIER_NOT_IN_ORGANIZATION");
    expect(res.body.details).toEqual({ supplierId: "sup_foreign" });
    expect(models.purchase.update).not.toHaveBeenCalled();
  });

  it("accepts a supplier that belongs to the organization", async () => {
    const res = await request(app)
      .put("/api/purchases/pur_1")
      .set(auth())
      .send({ supplierId: "sup_1" });

    expect(res.status).toBe(200);
    expect(models.supplier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sup_1", organizationId: ORG } })
    );
  });

  it("does not look up a supplier when the body carries none", async () => {
    await request(app).put("/api/purchases/pur_1").set(auth()).send({ status: "Completed" });

    expect(models.supplier.findFirst).not.toHaveBeenCalled();
  });

  it("404s when the purchase belongs to another organization", async () => {
    models.purchase.update.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .put("/api/purchases/foreign")
      .set(auth())
      .send({ status: "Completed" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /api/purchases/:id", () => {
  it("deletes scoped to the organization and returns 204", async () => {
    const res = await request(app).delete("/api/purchases/pur_1").set(auth());

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(models.purchase.delete).toHaveBeenCalledWith({
      where: { id: "pur_1", organizationId: ORG },
    });
  });

  it("404s for a purchase owned by another tenant", async () => {
    models.purchase.delete.mockRejectedValue(prismaError("P2025"));

    const res = await request(app).delete("/api/purchases/foreign").set(auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("leaves stock untouched, matching the legacy delete", async () => {
    await request(app).delete("/api/purchases/pur_1").set(auth());

    expect(models.inventory.upsert).not.toHaveBeenCalled();
    expect(models.inventoryLog.create).not.toHaveBeenCalled();
  });
});
