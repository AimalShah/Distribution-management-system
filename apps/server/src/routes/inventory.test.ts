import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER, USER_ENV_VAR, USER_HEADER } from "../middleware/auth-context";

const reorderLevelField = { modelName: "Inventory", name: "reorderLevel" };

const { models, transaction } = vi.hoisted(() => {
  const reorderLevel = Object.freeze({ modelName: "Inventory", name: "reorderLevel" });

  const models = {
    member: { findFirst: async () => ({ role: "owner" }) },
    inventory: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      // Stands in for the field reference the service compares `quantityOnHand`
      // against, so the test can assert the column to column comparison is what
      // actually reaches Prisma.
      fields: { reorderLevel },
    },
    inventoryLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    product: { findFirst: vi.fn(), findMany: vi.fn() },
    stockBatch: { findMany: vi.fn(), update: vi.fn() },
    reorderLevel,
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

const USER = "user_1";

const auth = (withUser = true) => ({
  [ORGANIZATION_HEADER]: ORG,
  ...(withUser ? { [USER_HEADER]: USER } : {}),
});

const inventoryFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "inv_1",
  productId: "prod_1",
  organizationId: ORG,
  quantityOnHand: 10,
  quantityReserved: 0,
  reorderLevel: 5,
  maxStockLevel: 100,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  product: { id: "prod_1", name: "Widget" },
  _count: { logs: 3 },
  ...overrides,
});

const logFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "log_1",
  inventoryId: "inv_1",
  productId: "prod_1",
  userId: USER,
  movementType: "OUT",
  quantity: 2,
  previousQty: 10,
  newQty: 8,
  reason: "Damaged in transit",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  product: { id: "prod_1", name: "Widget" },
  user: { name: "Ada", email: "ada@example.com" },
  inventory: inventoryFixture(),
  ...overrides,
});

const prismaError = (code: string, meta?: Record<string, unknown>) => ({
  code,
  meta,
  name: "PrismaClientKnownRequestError",
});

beforeEach(() => {
  vi.clearAllMocks();
  models.inventory.findFirst.mockResolvedValue(inventoryFixture());
  models.inventory.findFirstOrThrow.mockResolvedValue(inventoryFixture());
  models.inventory.findMany.mockResolvedValue([inventoryFixture()]);
  models.inventory.count.mockResolvedValue(1);
  models.inventory.create.mockResolvedValue(inventoryFixture());
  models.inventory.update.mockResolvedValue(inventoryFixture());
  // The guarded decrement claimed the units by default.
  models.inventory.updateMany.mockResolvedValue({ count: 1 });
  models.inventoryLog.findMany.mockResolvedValue([logFixture()]);
  models.inventoryLog.count.mockResolvedValue(1);
  models.inventoryLog.create.mockResolvedValue(logFixture());
  models.product.findFirst.mockResolvedValue({ id: "prod_1", productCode: "PROD-001" });
  models.product.findMany.mockResolvedValue([{ id: "prod_1", productCode: "PROD-001", name: "Product 1" }]);
  // No batches are tracked for this product, so FEFO and its reverse have
  // nothing to touch.
  models.stockBatch.findMany.mockResolvedValue([]);
});

describe("organization context", () => {
  it("rejects a request without an organization and never touches the database", async () => {
    const res = await request(app).get("/api/inventory");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(models.inventory.findMany).not.toHaveBeenCalled();
  });

  it("scopes the list to the caller's organization", async () => {
    await request(app).get("/api/inventory").set(auth());

    expect(models.inventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });
});

describe("GET /api/inventory", () => {
  it("returns a paginated envelope ordered by last update", async () => {
    models.inventory.count.mockResolvedValue(21);

    const res = await request(app).get("/api/inventory").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(21);
    expect(res.body.pageCount).toBe(2);
    expect(models.inventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { updatedAt: "desc" },
      })
    );
  });

  it("counts the logs instead of embedding every one of them", async () => {
    await request(app).get("/api/inventory").set(auth());

    const arg = models.inventory.findMany.mock.calls[0][0] as {
      include: Record<string, unknown>;
    };

    expect(arg.include).toHaveProperty("product");
    expect(arg.include).toHaveProperty("_count");
    expect(arg.include).not.toHaveProperty("logs");
  });

  it("rejects a bad page", async () => {
    const res = await request(app).get("/api/inventory?page=0").set(auth());

    expect(res.status).toBe(400);
    expect(models.inventory.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/inventory/logs", () => {
  it("scopes logs through the product relation and orders newest first", async () => {
    const res = await request(app).get("/api/inventory/logs").set(auth());

    expect(res.status).toBe(200);
    expect(models.inventoryLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { product: { organizationId: ORG } },
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("filters by product and ignores an empty filter", async () => {
    await request(app).get("/api/inventory/logs?productId=prod_9").set(auth());
    expect(models.inventoryLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { product: { organizationId: ORG }, productId: "prod_9" },
      })
    );

    await request(app).get("/api/inventory/logs?productId=").set(auth());
    expect(models.inventoryLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { product: { organizationId: ORG } } })
    );
  });

  it("selects only name and email from the user", async () => {
    await request(app).get("/api/inventory/logs").set(auth());

    const arg = models.inventoryLog.findMany.mock.calls[0][0] as {
      include: { user: { select: Record<string, boolean> } };
    };

    expect(arg.include.user.select).toEqual({ name: true, email: true });
  });

  it("does not fall through to the :id route", async () => {
    await request(app).get("/api/inventory/logs").set(auth());

    expect(models.inventory.findFirst).not.toHaveBeenCalled();
  });
});

describe("GET /api/inventory/low-stock", () => {
  it("compares quantityOnHand against reorderLevel", async () => {
    const res = await request(app).get("/api/inventory/low-stock").set(auth());

    expect(res.status).toBe(200);
    expect(models.inventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          quantityOnHand: { lte: reorderLevelField },
        },
        orderBy: { quantityOnHand: "asc" },
      })
    );
  });

  it("does not fall through to the :id route", async () => {
    await request(app).get("/api/inventory/low-stock").set(auth());

    expect(models.inventory.findFirst).not.toHaveBeenCalled();
  });

  it("is paginated", async () => {
    models.inventory.count.mockResolvedValue(45);

    const res = await request(app).get("/api/inventory/low-stock?page=2&pageSize=10").set(auth());

    expect(res.body.pageCount).toBe(5);
    expect(models.inventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });
});

describe("GET /api/inventory/:id", () => {
  it("scopes the lookup to the organization", async () => {
    const res = await request(app).get("/api/inventory/inv_1").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("inv_1");
    expect(models.inventory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv_1", organizationId: ORG } })
    );
  });

  it("404s instead of reading another tenant's stock row", async () => {
    models.inventory.findFirst.mockResolvedValue(null);

    const res = await request(app).get("/api/inventory/inv_foreign").set(auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("INVENTORY_NOT_FOUND");
  });
});

describe("POST /api/inventory", () => {
  it("creates a stock row scoped to the organization", async () => {
    const res = await request(app)
      .post("/api/inventory")
      .set(auth())
      .send({ productId: "prod_1", quantityOnHand: 25, reorderLevel: 5 });

    expect(res.status).toBe(201);
    expect(models.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod_1", organizationId: ORG },
      })
    );
    expect(models.inventory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "prod_1",
          organizationId: ORG,
          quantityOnHand: 25,
          quantityReserved: 0,
          reorderLevel: 5,
          maxStockLevel: null,
        }),
      })
    );
  });

  it("keeps an explicit zero instead of falling back to the default", async () => {
    await request(app)
      .post("/api/inventory")
      .set(auth())
      .send({ productId: "prod_1", quantityOnHand: 0, quantityReserved: 0 });

    expect(models.inventory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantityOnHand: 0,
          quantityReserved: 0,
        }),
      })
    );
  });

  it("refuses a product from another organization before writing", async () => {
    models.product.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/inventory")
      .set(auth())
      .send({ productId: "prod_foreign", quantityOnHand: 5 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PRODUCT_NOT_IN_ORGANIZATION");
    expect(models.inventory.create).not.toHaveBeenCalled();
  });

  it("rejects a negative quantity and a missing product", async () => {
    const negative = await request(app)
      .post("/api/inventory")
      .set(auth())
      .send({ productId: "prod_1", quantityOnHand: -1 });

    const missingProduct = await request(app)
      .post("/api/inventory")
      .set(auth())
      .send({ quantityOnHand: 5 });

    expect(negative.status).toBe(400);
    expect(missingProduct.status).toBe(400);
    expect(models.inventory.create).not.toHaveBeenCalled();
  });

  it("maps a duplicate product to 409", async () => {
    models.inventory.create.mockRejectedValue(prismaError("P2002", { target: ["productId"] }));

    const res = await request(app)
      .post("/api/inventory")
      .set(auth())
      .send({ productId: "prod_1", quantityOnHand: 5 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIQUE_CONSTRAINT");
  });
});

describe("POST /api/inventory/adjust", () => {
  it("requires a user and writes nothing without one", async () => {
    vi.stubEnv(USER_ENV_VAR, "");

    const res = await request(app)
      .post("/api/inventory/adjust")
      .set(auth(false))
      .send({ inventoryId: "inv_1", movementType: "OUT", quantity: 2, reason: "x" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(models.inventoryLog.create).not.toHaveBeenCalled();
  });

    it("scopes the lookup to the organization and 404s a foreign row", async () => {
      models.inventory.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/inventory/adjust")
        .set(auth())
        .send({ inventoryId: "inv_foreign", movementType: "IN", quantity: 2, reason: "x" });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("INVENTORY_NOT_FOUND");
      expect(models.inventory.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "inv_foreign", organizationId: ORG } })
      );
      expect(models.inventory.update).not.toHaveBeenCalled();
      expect(models.inventory.updateMany).not.toHaveBeenCalled();
    });

  describe("movement directions", () => {
    const INCREASING = ["IN", "RETURN"] as const;
    const DECREASING = ["OUT", "DAMAGED", "EXPIRED"] as const;

    /**
     * Stands the mocks up so the row behaves the way the database would: the
     * scope read sees `onHand`, the write lands on the figure the caller asked
     * for, and the follow-up read sees the row as it stands afterwards.
     */
    const adjust = (movementType: string, quantity: number, onHand = 10) => {
      const net = INCREASING.includes(movementType as (typeof INCREASING)[number])
        ? onHand + quantity
        : movementType === "ADJUSTMENT"
          ? quantity
          : onHand - quantity;

      models.inventory.findFirst.mockResolvedValue(inventoryFixture({ quantityOnHand: onHand }));
      // A directional movement writes through `increment`; a count writes the
      // absolute figure through `set`. Both come back as the new quantity.
      models.inventory.update.mockResolvedValue({ quantityOnHand: net });
      models.inventory.updateMany.mockResolvedValue({ count: 1 });
      models.inventory.findFirstOrThrow.mockResolvedValue(inventoryFixture({ quantityOnHand: net }));

      return request(app)
        .post("/api/inventory/adjust")
        .set(auth())
        .send({ inventoryId: "inv_1", movementType, quantity, reason: "test" });
    };

    it("adds with a single increment rather than a computed figure", async () => {
      for (const movementType of INCREASING) {
        const res = await adjust(movementType, 4);
        expect(res.status).toBe(200);

        expect(models.inventory.update).toHaveBeenLastCalledWith(
          expect.objectContaining({
            where: { id: "inv_1", organizationId: ORG },
            data: { quantityOnHand: { increment: 4 } },
          })
        );
        // The guarded decrement is for the decreasing direction only.
        expect(models.inventory.updateMany).not.toHaveBeenCalled();
      }
    });

    it("subtracts behind a gte guard in the same statement", async () => {
      for (const movementType of DECREASING) {
        const res = await adjust(movementType, 4);
        expect(res.status).toBe(200);

        expect(models.inventory.updateMany).toHaveBeenLastCalledWith({
          where: {
            id: "inv_1",
            organizationId: ORG,
            quantityOnHand: { gte: 4 },
          },
          data: { quantityOnHand: { decrement: 4 } },
        });
        expect(models.inventory.update).not.toHaveBeenCalled();
      }
    });

    it("records a movement that adds up to the change it made", async () => {
      await adjust("OUT", 4);

      const { quantity, previousQty, newQty } = models.inventoryLog.create.mock
        .calls[0][0].data as { quantity: number; previousQty: number; newQty: number };

      expect({ quantity, previousQty, newQty }).toEqual({
        quantity: 4,
        previousQty: 10,
        newQty: 6,
      });
      expect(previousQty - quantity).toBe(newQty);
    });

    it("derives the opening figure from the row after the write, not before it", async () => {
      // A purchase committed between the scope read and this decrement. The
      // ledger has to describe the row the write actually landed on.
      models.inventory.findFirst.mockResolvedValue(inventoryFixture({ quantityOnHand: 10 }));
      models.inventory.updateMany.mockResolvedValue({ count: 1 });
      models.inventory.findFirstOrThrow
        .mockResolvedValueOnce(inventoryFixture({ quantityOnHand: 6 }))
        .mockResolvedValue(inventoryFixture({ quantityOnHand: 6 }));

      const res = await request(app)
        .post("/api/inventory/adjust")
        .set(auth())
        .send({ inventoryId: "inv_1", movementType: "OUT", quantity: 4, reason: "test" });

      expect(res.status).toBe(200);

      const { previousQty, newQty } = models.inventoryLog.create.mock.calls[0][0].data as {
        previousQty: number;
        newQty: number;
      };

      expect({ previousQty, newQty }).toEqual({ previousQty: 10, newQty: 6 });
    });

    it("refuses a write-off larger than the stock instead of clamping at zero", async () => {
      models.inventory.findFirst.mockResolvedValue(inventoryFixture({ quantityOnHand: 10 }));
      models.inventory.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(app)
        .post("/api/inventory/adjust")
        .set(auth())
        .send({ inventoryId: "inv_1", movementType: "DAMAGED", quantity: 25, reason: "test" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INSUFFICIENT_STOCK");
      expect(res.body.details).toEqual({ available: 10, requested: 25 });
      expect(models.inventoryLog.create).not.toHaveBeenCalled();
    });

    it("tells a row deleted mid-flight apart from a genuine shortage", async () => {
      models.inventory.findFirst.mockResolvedValue(inventoryFixture());
      models.inventory.updateMany.mockResolvedValue({ count: 0 });
      // The scope read found the row; the post-guard read does not.
      models.inventory.findFirst
        .mockResolvedValueOnce(inventoryFixture())
        .mockResolvedValue(null);

      const res = await request(app)
        .post("/api/inventory/adjust")
        .set(auth())
        .send({ inventoryId: "inv_1", movementType: "OUT", quantity: 4, reason: "test" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVENTORY_ROW_MISSING");
    });

    it("refuses a directional movement of zero", async () => {
      const res = await adjust("OUT", 0);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("QUANTITY_MUST_BE_POSITIVE");
      // Refused before the transaction opens, so nothing was read or written.
      expect(models.inventory.findFirst).not.toHaveBeenCalled();
      expect(models.inventoryLog.create).not.toHaveBeenCalled();
    });

    it("sets the absolute figure for ADJUSTMENT and logs the signed difference", async () => {
      const res = await adjust("ADJUSTMENT", 25);

      expect(res.status).toBe(200);
      expect(models.inventory.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { quantityOnHand: 25 } })
      );
      // A count's figure is the change it represents, so the ledger identity is
      // previousQty + quantity = newQty rather than a subtraction.
      expect(models.inventoryLog.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: "ADJUSTMENT",
            quantity: 15,
            previousQty: 10,
            newQty: 25,
          }),
        })
      );
    });

    it("allows a count of zero and logs the reduction", async () => {
      const res = await adjust("ADJUSTMENT", 0);

      expect(res.status).toBe(200);
      expect(models.inventory.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { quantityOnHand: 0 } })
      );
      expect(models.inventoryLog.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: -10,
            previousQty: 10,
            newQty: 0,
          }),
        })
      );
    });

    it("rejects TRANSFER because the model has no destination", async () => {
      const res = await adjust("TRANSFER", 5);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("UNSUPPORTED_MOVEMENT");
      expect(models.inventory.update).not.toHaveBeenCalled();
      expect(models.inventoryLog.create).not.toHaveBeenCalled();
    });

    it("rejects an unknown movement type", async () => {
      const res = await adjust("MELTED", 5);

      expect(res.status).toBe(400);
      expect(models.inventoryLog.create).not.toHaveBeenCalled();
    });

    it("requires a reason", async () => {
      const res = await adjust("IN", 5);
      expect(res.status).toBe(200);

      const missing = await request(app)
        .post("/api/inventory/adjust")
        .set(auth())
        .send({ inventoryId: "inv_1", movementType: "IN", quantity: 5, reason: "" });

      expect(missing.status).toBe(400);
    });
  });
});

describe("PUT /api/inventory/:id/settings", () => {
  it("updates settings scoped to the organization", async () => {
    const res = await request(app)
      .put("/api/inventory/inv_1/settings")
      .set(auth())
      .send({ reorderLevel: 12, maxStockLevel: 200 });

    expect(res.status).toBe(200);
    expect(models.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_1", organizationId: ORG },
        data: { reorderLevel: 12, maxStockLevel: 200 },
      })
    );
  });

  it("rejects an empty update", async () => {
    const res = await request(app)
      .put("/api/inventory/inv_1/settings")
      .set(auth())
      .send({});

    expect(res.status).toBe(400);
    expect(models.inventory.update).not.toHaveBeenCalled();
  });

  it("rejects a negative level", async () => {
    const res = await request(app)
      .put("/api/inventory/inv_1/settings")
      .set(auth())
      .send({ reorderLevel: -1 });

    expect(res.status).toBe(400);
    expect(models.inventory.update).not.toHaveBeenCalled();
  });

  it("404s a foreign row through the P2025 mapping", async () => {
    models.inventory.update.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .put("/api/inventory/inv_foreign/settings")
      .set(auth())
      .send({ reorderLevel: 1 });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/inventory/bulk-import", () => {
  it("rejects unauthorized access without organization context", async () => {
    const res = await request(app)
      .post("/api/inventory/bulk-import")
      .send({ rows: [{ productCode: "P-1", quantityOnHand: 10 }] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
  });

  it("rejects invalid payload format", async () => {
    const res = await request(app)
      .post("/api/inventory/bulk-import")
      .set(auth())
      .send({ invalidField: 123 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_BULK_IMPORT_PAYLOAD");
  });

  it("imports valid rows and reports row success", async () => {
    models.product.findMany.mockResolvedValue([
      { id: "prod_1", productCode: "PROD-001", name: "Widget" },
    ]);
    models.inventory.findFirst.mockResolvedValue(null);
    models.inventory.create.mockResolvedValue(inventoryFixture());

    const res = await request(app)
      .post("/api/inventory/bulk-import")
      .set(auth())
      .send({
        rows: [
          {
            productCode: "PROD-001",
            quantityOnHand: 50,
            reorderLevel: 10,
            maxStockLevel: 100,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.created).toBe(1);
    expect(res.body.errors).toHaveLength(0);
    expect(models.inventory.create).toHaveBeenCalled();
  });

  it("updates existing inventory record if already present", async () => {
    models.product.findMany.mockResolvedValue([
      { id: "prod_1", productCode: "PROD-001", name: "Widget" },
    ]);
    models.inventory.findFirst.mockResolvedValue({ id: "inv_1", quantityOnHand: 20 });
    models.inventory.update.mockResolvedValue({ id: "inv_1", quantityOnHand: 75 });

    const res = await request(app)
      .post("/api/inventory/bulk-import")
      .set(auth())
      .send({
        rows: [
          {
            productCode: "PROD-001",
            quantityOnHand: 75,
            reorderLevel: 15,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.updated).toBe(1);
    expect(res.body.errors).toHaveLength(0);
    expect(models.inventory.update).toHaveBeenCalled();
  });

  it("reports error for non-existent product in organization", async () => {
    models.product.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post("/api/inventory/bulk-import")
      .set(auth())
      .send({
        rows: [
          {
            productCode: "NONEXISTENT",
            quantityOnHand: 25,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(0);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].row).toBe(1);
    expect(res.body.errors[0].error).toContain("NONEXISTENT");
  });

  it("parses CSV string payload directly", async () => {
    models.product.findMany.mockResolvedValue([
      { id: "prod_1", productCode: "PROD-001", name: "Widget" },
    ]);
    models.inventory.findFirst.mockResolvedValue(null);

    const csvData = "productCode,quantityOnHand,reorderLevel\nPROD-001,40,5";

    const res = await request(app)
      .post("/api/inventory/bulk-import")
      .set(auth())
      .send({ csv: csvData });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.errors).toHaveLength(0);
  });
});

