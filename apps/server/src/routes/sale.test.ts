import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER, USER_HEADER } from "../middleware/auth-context";

const { models, transaction } = vi.hoisted(() => {
  const models = {
    sale: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    customer: { findFirst: vi.fn() },
    product: { findMany: vi.fn() },
    inventory: { findFirst: vi.fn(), updateMany: vi.fn() },
    inventoryLog: { create: vi.fn() },
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

const auth = () => ({
  [ORGANIZATION_HEADER]: ORG,
  [USER_HEADER]: USER,
});

const customer = { id: "cus_1", customerName: "Acme Retail" };

const saleItem = (overrides: Record<string, unknown> = {}) => ({
  id: "si_1",
  saleId: "sal_1",
  productId: "prod_1",
  quantity: 2,
  unitPrice: 25,
  totalPrice: 50,
  taxPercent: null,
  discount: null,
  product: { id: "prod_1", name: "Widget", unit: "pcs" },
  ...overrides,
});

const saleFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "sal_1",
  saleCode: "SAL-001",
  organizationId: ORG,
  customerId: "cus_1",
  totalAmount: 50,
  taxAmount: null,
  discount: null,
  status: "Pending",
  saleDate: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  customer,
  items: [saleItem()],
  _count: { items: 1 },
  ...overrides,
});

const validBody = {
  saleCode: "SAL-001",
  customerId: "cus_1",
  status: "Pending",
  items: [{ productId: "prod_1", quantity: 2, unitPrice: 25 }],
};

const prismaError = (code: string, meta?: Record<string, unknown>) => ({
  code,
  meta,
  name: "PrismaClientKnownRequestError",
});

beforeEach(() => {
  vi.clearAllMocks();
  models.sale.findMany.mockResolvedValue([saleFixture()]);
  models.sale.count.mockResolvedValue(1);
  models.sale.findFirst.mockResolvedValue(saleFixture());
  models.sale.create.mockResolvedValue(saleFixture());
  models.sale.update.mockResolvedValue(saleFixture());
  models.sale.delete.mockResolvedValue(saleFixture());
  models.customer.findFirst.mockResolvedValue({ id: "cus_1" });
  models.product.findMany.mockResolvedValue([{ id: "prod_1" }]);
  models.inventory.findFirst.mockResolvedValue({ id: "inv_1", quantityOnHand: 10 });
  models.inventory.updateMany.mockResolvedValue({ count: 1 });
  models.inventoryLog.create.mockResolvedValue({ id: "log_1" });
});

describe("organization context", () => {
  it("rejects a request without an organization and never touches the database", async () => {
    const res = await request(app).get("/api/sales");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(models.sale.findMany).not.toHaveBeenCalled();
  });

  it("scopes the list to the caller's organization", async () => {
    await request(app).get("/api/sales").set(auth());

    expect(models.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });
});

describe("GET /api/sales", () => {
  it("returns a paginated envelope ordered by sale date", async () => {
    models.sale.count.mockResolvedValue(21);

    const res = await request(app).get("/api/sales").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(21);
    expect(res.body.pageCount).toBe(2);
    expect(models.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20, orderBy: { saleDate: "desc" } })
    );
  });

  it("filters by code and by status, and ignores an empty search", async () => {
    await request(app).get("/api/sales?search=sal-00&status=Completed").set(auth());
    expect(models.sale.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          status: "Completed",
          saleCode: { contains: "sal-00", mode: "insensitive" },
        },
      })
    );

    await request(app).get("/api/sales?search=").set(auth());
    expect(models.sale.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });

  it("rejects an unknown status and a bad page", async () => {
    const badStatus = await request(app).get("/api/sales?status=Refunded").set(auth());
    const badPage = await request(app).get("/api/sales?page=0").set(auth());

    expect(badStatus.status).toBe(400);
    expect(badPage.status).toBe(400);
    expect(models.sale.findMany).not.toHaveBeenCalled();
  });

  it("counts the line items instead of embedding them on the list", async () => {
    await request(app).get("/api/sales").set(auth());

    const arg = models.sale.findMany.mock.calls[0][0] as {
      include: Record<string, unknown>;
    };
    expect(arg.include).toHaveProperty("_count");
    expect(arg.include).not.toHaveProperty("items");
  });
});

describe("GET /api/sales/:id", () => {
  it("matches either the id or the sale code, scoped to the organization", async () => {
    const res = await request(app).get("/api/sales/SAL-001").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("sal_1");
    expect(models.sale.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: ORG,
        OR: [{ id: "SAL-001" }, { saleCode: "SAL-001" }],
      },
      include: { customer: true, items: { include: { product: true } } },
    });
  });

  it("404s instead of reading another tenant's invoice by code", async () => {
    models.sale.findFirst.mockResolvedValue(null);

    const res = await request(app).get("/api/sales/SAL-FOREIGN").set(auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("SALE_NOT_FOUND");
  });
});

describe("GET /api/sales/customer/:customerId", () => {
  it("scopes the customer history to the organization", async () => {
    const res = await request(app).get("/api/sales/customer/cus_1").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.pageCount).toBe(1);
    expect(models.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: "cus_1", organizationId: ORG },
      })
    );
  });

  it("paginates instead of returning a lifetime of sales in one response", async () => {
    await request(app).get("/api/sales/customer/cus_1?page=3&pageSize=10").set(auth());

    expect(models.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it("rejects an out of range page", async () => {
    const res = await request(app).get("/api/sales/customer/cus_1?pageSize=500").set(auth());

    expect(res.status).toBe(400);
    expect(models.sale.findMany).not.toHaveBeenCalled();
  });

  it("does not fall through to the :id route", async () => {
    await request(app).get("/api/sales/customer/cus_1").set(auth());

    expect(models.sale.findFirst).not.toHaveBeenCalled();
  });
});

describe("POST /api/sales", () => {
  it("creates the sale, deducts stock and logs the OUT movement", async () => {
    models.inventory.findFirst
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 10 })
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 8 });

    const res = await request(app).post("/api/sales").set(auth()).send(validBody);

    expect(res.status).toBe(201);
    expect(transaction).toHaveBeenCalledTimes(1);

    expect(models.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          saleCode: "SAL-001",
          organizationId: ORG,
          totalAmount: 50,
          items: {
            create: [
              expect.objectContaining({
                productId: "prod_1",
                quantity: 2,
                unitPrice: 25,
                totalPrice: 50,
              }),
            ],
          },
        }),
      })
    );

    expect(models.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        productId: "prod_1",
        organizationId: ORG,
        quantityOnHand: { gte: 2 },
      },
      data: { quantityOnHand: { decrement: 2 } },
    });

    expect(models.inventoryLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inventoryId: "inv_1",
        productId: "prod_1",
        userId: USER,
        movementType: "OUT",
        quantity: 2,
        previousQty: 10,
        newQty: 8,
        reference: "SAL-001",
      }),
    });
  });

  it("computes the total server side as lines plus tax minus discount", async () => {
    await request(app)
      .post("/api/sales")
      .set(auth())
      .send({
        ...validBody,
        taxAmount: 8,
        discount: 3,
        items: [
          { productId: "prod_1", quantity: 2, unitPrice: 25, taxPercent: 10 },
        ],
      });

    const arg = models.sale.create.mock.calls[0][0] as { data: { totalAmount: number } };
    // 2*25 = 50, + 8 tax, - 3 discount. The line taxPercent is stored but was
    // never part of the legacy total.
    expect(arg.data.totalAmount).toBe(55);
  });

  it("refuses to sell more than is on hand", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set(auth())
      .send({ ...validBody, items: [{ productId: "prod_1", quantity: 20, unitPrice: 25 }] });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STOCK");
    expect(res.body.details).toEqual({
      shortages: [{ productId: "prod_1", available: 10, requested: 20 }],
    });
    expect(models.sale.create).not.toHaveBeenCalled();
    expect(models.inventory.updateMany).not.toHaveBeenCalled();
    expect(models.inventoryLog.create).not.toHaveBeenCalled();
  });

  it("treats a missing inventory row as zero stock instead of skipping the line", async () => {
    models.inventory.findFirst.mockResolvedValue(null);

    const res = await request(app).post("/api/sales").set(auth()).send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STOCK");
    expect(res.body.details.shortages[0].available).toBe(0);
    expect(models.sale.create).not.toHaveBeenCalled();
  });

  it("sums repeated lines for one product before comparing to stock", async () => {
    // 3 + 3 across two lines exceeds the 5 on hand even though neither line does.
    models.inventory.findFirst.mockResolvedValue({ id: "inv_1", quantityOnHand: 5 });

    const res = await request(app)
      .post("/api/sales")
      .set(auth())
      .send({
        ...validBody,
        items: [
          { productId: "prod_1", quantity: 3, unitPrice: 10 },
          { productId: "prod_1", quantity: 3, unitPrice: 10 },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.details.shortages).toEqual([
      { productId: "prod_1", available: 5, requested: 6 },
    ]);
  });

  it("deducts repeated lines in sequence", async () => {
    // One availability read, then one read back after each line's decrement:
    // 10 -> 8 -> 6.
    models.inventory.findFirst
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 10 })
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 8 })
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 6 });

    const res = await request(app)
      .post("/api/sales")
      .set(auth())
      .send({
        ...validBody,
        items: [
          { productId: "prod_1", quantity: 2, unitPrice: 25 },
          { productId: "prod_1", quantity: 2, unitPrice: 25 },
        ],
      });

    expect(res.status).toBe(201);
    expect(models.inventoryLog.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ previousQty: 10, newQty: 8, quantity: 2 }),
    });
    expect(models.inventoryLog.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ previousQty: 8, newQty: 6, quantity: 2 }),
    });
  });

  it("logs an OUT whose quantities always balance", async () => {
    models.inventory.findFirst
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 10 })
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 8 });

    await request(app).post("/api/sales").set(auth()).send(validBody);

    const arg = models.inventoryLog.create.mock.calls[0][0] as {
      data: { previousQty: number; quantity: number; newQty: number };
    };
    expect(arg.data.previousQty - arg.data.quantity).toBe(arg.data.newQty);
  });

  it("makes the stock check and the deduction one statement", async () => {
    // A read-then-write pair cannot hold under READ COMMITTED: two concurrent
    // sales of 8 against 10 on hand would both pass a pre-check and both write
    // 2, so 16 units would be sold against 2 left. The `gte` guard is evaluated
    // by the database against the row it is updating, so the second one to
    // arrive matches nothing and is refused.
    await request(app).post("/api/sales").set(auth()).send(validBody);

    const arg = models.inventory.updateMany.mock.calls[0][0] as {
      where: { quantityOnHand: { gte: number } };
      data: { quantityOnHand: { decrement: number } };
    };
    expect(arg.where.quantityOnHand.gte).toBe(2);
    expect(arg.data.quantityOnHand).toEqual({ decrement: 2 });
  });

  it("refuses the sale when the atomic decrement finds nothing to claim", async () => {
    // The availability pass saw 10, but a concurrent transaction took 8 first,
    // so the guarded update matched zero rows and only 2 remain.
    models.inventory.findFirst
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 10 })
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 2 });
    models.inventory.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app).post("/api/sales").set(auth()).send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STOCK");
    expect(res.body.details.shortages).toEqual([
      { productId: "prod_1", available: 2, requested: 2 },
    ]);
    expect(models.inventoryLog.create).not.toHaveBeenCalled();
  });

  it("refuses a customer from another organization", async () => {
    models.customer.findFirst.mockResolvedValue(null);

    const res = await request(app).post("/api/sales").set(auth()).send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CUSTOMER_NOT_IN_ORGANIZATION");
    expect(res.body.details).toEqual({ customerId: "cus_1" });
    expect(models.sale.create).not.toHaveBeenCalled();
  });

  it("refuses products from another organization", async () => {
    models.product.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post("/api/sales")
      .set(auth())
      .send({ ...validBody, items: [{ productId: "prod_foreign", quantity: 1, unitPrice: 5 }] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PRODUCT_NOT_IN_ORGANIZATION");
    expect(res.body.details).toEqual({ productIds: ["prod_foreign"] });
    expect(models.sale.create).not.toHaveBeenCalled();
  });

  it("refuses a discount that drives the total negative", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set(auth())
      .send({ ...validBody, discount: 500 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_TOTAL");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("requires a user id to attribute the inventory log", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set({ [ORGANIZATION_HEADER]: ORG })
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(models.sale.create).not.toHaveBeenCalled();
  });

  it("leaves saleDate to the column default when it is absent", async () => {
    await request(app).post("/api/sales").set(auth()).send(validBody);

    expect(models.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ saleDate: undefined }),
      })
    );
  });

  it("accepts an explicit sale date", async () => {
    await request(app)
      .post("/api/sales")
      .set(auth())
      .send({ ...validBody, saleDate: "2026-03-04" });

    expect(models.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          saleDate: new Date("2026-03-04T00:00:00.000Z"),
        }),
      })
    );
  });

  it("rejects an unknown status", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set(auth())
      .send({ ...validBody, status: "Refunded" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(models.sale.create).not.toHaveBeenCalled();
  });

  it("rejects an empty item list and a fractional quantity", async () => {
    const empty = await request(app)
      .post("/api/sales")
      .set(auth())
      .send({ ...validBody, items: [] });

    const fractional = await request(app)
      .post("/api/sales")
      .set(auth())
      .send({ ...validBody, items: [{ productId: "prod_1", quantity: 1.5, unitPrice: 5 }] });

    expect(empty.status).toBe(400);
    expect(fractional.status).toBe(400);
    expect(models.sale.create).not.toHaveBeenCalled();
  });

  it("rejects a client supplied totalPrice and keeps the server's own", async () => {
    await request(app)
      .post("/api/sales")
      .set(auth())
      .send({ ...validBody, items: [{ productId: "prod_1", quantity: 2, unitPrice: 25, totalPrice: 1 }] });

    const arg = models.sale.create.mock.calls[0][0] as {
      data: { totalAmount: number; items: { create: { totalPrice: number }[] } };
    };
    expect(arg.data.totalAmount).toBe(50);
    expect(arg.data.items.create[0].totalPrice).toBe(50);
  });

  it("does not copy the header discount onto every line", async () => {
    await request(app)
      .post("/api/sales")
      .set(auth())
      .send({ ...validBody, discount: 5 });

    const arg = models.sale.create.mock.calls[0][0] as {
      data: { items: { create: Record<string, unknown>[] } };
    };
    expect(arg.data.items.create[0].discount).toBeUndefined();
  });

  it("maps a duplicate sale code to a conflict", async () => {
    models.sale.create.mockRejectedValue(
      prismaError("P2002", { target: ["saleCode"] })
    );

    const res = await request(app).post("/api/sales").set(auth()).send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIQUE_CONSTRAINT");
  });

  it("surfaces a stock row that disappears mid transaction", async () => {
    // The availability pass saw the row, but by the time the deduction runs a
    // concurrent transaction has deleted it, so the guarded update matches
    // nothing and the follow-up read finds no row either.
    models.inventory.findFirst
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 10 })
      .mockResolvedValueOnce(null);
    models.inventory.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app).post("/api/sales").set(auth()).send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVENTORY_ROW_MISSING");
    expect(models.inventoryLog.create).not.toHaveBeenCalled();
  });
});

describe("PUT /api/sales/:id", () => {
  it("updates header columns scoped to the organization", async () => {
    const res = await request(app)
      .put("/api/sales/sal_1")
      .set(auth())
      .send({ status: "Completed", taxAmount: 5 });

    expect(res.status).toBe(200);
    expect(models.sale.update).toHaveBeenCalledWith({
      where: { id: "sal_1", organizationId: ORG },
      data: { status: "Completed", taxAmount: 5 },
      include: { customer: true, items: { include: { product: true } } },
    });
  });

  it("ignores items and a client supplied total", async () => {
    await request(app)
      .put("/api/sales/sal_1")
      .set(auth())
      .send({ status: "Pending", totalAmount: 1, items: [{ productId: "prod_1", quantity: 9, unitPrice: 1 }] });

    const arg = models.sale.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data).toEqual({ status: "Pending" });
    expect(models.inventory.updateMany).not.toHaveBeenCalled();
  });

  it("404s for a sale owned by another tenant", async () => {
    models.sale.update.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .put("/api/sales/foreign")
      .set(auth())
      .send({ status: "Completed" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("refuses to re-point the invoice at another tenant's customer", async () => {
    models.customer.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .put("/api/sales/sal_1")
      .set(auth())
      .send({ customerId: "cus_foreign" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CUSTOMER_NOT_IN_ORGANIZATION");
    expect(res.body.details).toEqual({ customerId: "cus_foreign" });
    expect(models.sale.update).not.toHaveBeenCalled();
  });

  it("accepts a customer that belongs to the organization", async () => {
    const res = await request(app)
      .put("/api/sales/sal_1")
      .set(auth())
      .send({ customerId: "cus_1" });

    expect(res.status).toBe(200);
    expect(models.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "cus_1", organizationId: ORG } })
    );
  });

  it("does not look up a customer when the body carries none", async () => {
    await request(app).put("/api/sales/sal_1").set(auth()).send({ status: "Completed" });

    expect(models.customer.findFirst).not.toHaveBeenCalled();
  });

  it("does not return stock when a sale is cancelled", async () => {
    await request(app).put("/api/sales/sal_1").set(auth()).send({ status: "Cancelled" });

    expect(models.sale.update).toHaveBeenCalled();
    expect(models.inventory.updateMany).not.toHaveBeenCalled();
    expect(models.inventoryLog.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/sales/:id", () => {
  it("deletes scoped to the organization and returns 204", async () => {
    const res = await request(app).delete("/api/sales/sal_1").set(auth());

    expect(res.status).toBe(204);
    expect(models.sale.delete).toHaveBeenCalledWith({
      where: { id: "sal_1", organizationId: ORG },
    });
  });

  it("404s for a sale owned by another tenant", async () => {
    models.sale.delete.mockRejectedValue(prismaError("P2025"));

    const res = await request(app).delete("/api/sales/foreign").set(auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("does not return the consumed stock, matching the legacy delete", async () => {
    await request(app).delete("/api/sales/sal_1").set(auth());

    expect(models.inventory.updateMany).not.toHaveBeenCalled();
    expect(models.inventoryLog.create).not.toHaveBeenCalled();
  });
});
