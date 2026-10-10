import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER, USER_ENV_VAR, USER_HEADER } from "../middleware/auth-context";

const { models, transaction } = vi.hoisted(() => {
  const models = {
    member: { findFirst: vi.fn(async () => ({ role: "owner" })) },
    sale: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    customer: { findFirst: vi.fn() },
    product: { findMany: vi.fn() },
    return: { count: vi.fn(), findMany: vi.fn() },
    payment: { aggregate: vi.fn(), findMany: vi.fn() },
    inventory: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    inventoryLog: { create: vi.fn() },
    stockBatch: { findMany: vi.fn(), update: vi.fn() },
    companySettings: { findUnique: vi.fn() },
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
  amountPaid: 0,
  statusBeforeCancel: null,
  deletedAt: null,
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
  models.member.findFirst.mockResolvedValue({ role: "owner" });
  models.sale.findMany.mockResolvedValue([saleFixture()]);
  models.sale.count.mockResolvedValue(1);
  models.sale.findFirst.mockResolvedValue(saleFixture());
  models.sale.create.mockResolvedValue(saleFixture());
  models.sale.update.mockResolvedValue(saleFixture());
  models.sale.delete.mockResolvedValue(saleFixture());
  models.sale.aggregate.mockResolvedValue({ _sum: { totalAmount: 0, amountPaid: 0 } });
  models.customer.findFirst.mockResolvedValue({ id: "cus_1" });
  models.product.findMany.mockResolvedValue([{ id: "prod_1" }]);
  models.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  models.return.count.mockResolvedValue(0);
  models.return.findMany.mockResolvedValue([]);
  models.inventory.findFirst.mockResolvedValue({ id: "inv_1", quantityOnHand: 10 });
  models.inventory.findFirstOrThrow.mockResolvedValue({ id: "inv_1", quantityOnHand: 8 });
  models.inventory.update.mockResolvedValue({ quantityOnHand: 8 });
  models.inventory.updateMany.mockResolvedValue({ count: 1 });
  models.inventoryLog.create.mockResolvedValue({ id: "log_1" });
  // No batches are tracked for this product, so FEFO has nothing to touch.
  models.stockBatch.findMany.mockResolvedValue([]);
  models.companySettings.findUnique.mockResolvedValue(null);
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
      expect.objectContaining({ where: { organizationId: ORG, deletedAt: null } })
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
          deletedAt: null,
          status: "Completed",
          saleCode: { contains: "sal-00", mode: "insensitive" },
        },
      })
    );

    await request(app).get("/api/sales?search=").set(auth());
    expect(models.sale.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { organizationId: ORG, deletedAt: null } })
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
        where: { customerId: "cus_1", organizationId: ORG, deletedAt: null },
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

    // The stock-movement module resolves the row for the product, then
    // addresses the guard by that row's id within the tenant.
    expect(models.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        id: "inv_1",
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
    // One availability read, one resolve per line, then one read back after
    // each line's decrement: 10 -> 8 -> 6.
    models.inventory.findFirst
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 10 })
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 8 })
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 6 });
    models.inventory.findFirstOrThrow
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
    // so the guarded update matched zero rows and only 2 remain: the resolve
    // read and the follow-up read both see 2.
    models.inventory.findFirst
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 10 })
      .mockResolvedValueOnce({ id: "inv_1", quantityOnHand: 2 })
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
    vi.stubEnv(USER_ENV_VAR, "");

    const res = await request(app)
      .post("/api/sales")
      .set({ [ORGANIZATION_HEADER]: ORG })
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(models.sale.create).not.toHaveBeenCalled();
  });

  it("defaults an absent sale date to now, so the due date has an anchor", async () => {
    const before = Date.now();

    await request(app).post("/api/sales").set(auth()).send(validBody);

    const { saleDate, dueDate } = models.sale.create.mock.calls[0][0].data;

    // The column default would also be "now", but the service must resolve the
    // date itself: the due date is derived from it in the same transaction
    // (ADR 0009), so it cannot be left to the database.
    expect(saleDate).toBeInstanceOf(Date);
    expect(saleDate.getTime()).toBeGreaterThanOrEqual(before);

    // With no customer override and no Company settings, the documented
    // default is net-30, and the due date is that many days after the sale.
    expect(dueDate.getTime() - saleDate.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
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

  describe("credit limit enforcement (issue #49)", () => {
    it("refuses an over-limit sale with current outstanding, limit, and projected balance", async () => {
      // Customer has creditLimit of 100
      models.customer.findFirst.mockResolvedValue({ id: "cus_1", creditLimit: 100 });
      // Existing ledger has 80 totalAmount and 10 amountPaid -> outstanding = 70
      // New sale total is 50 -> projected = 120 > 100
      models.sale.aggregate.mockResolvedValue({ _sum: { totalAmount: 80, amountPaid: 10 } });

      const res = await request(app).post("/api/sales").set(auth()).send(validBody);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("CREDIT_LIMIT_EXCEEDED");
      expect(res.body.details).toEqual({
        outstanding: 70,
        limit: 100,
        projected: 120,
      });
      expect(models.sale.create).not.toHaveBeenCalled();
    });

    it("allows an over-limit sale when overrideCreditLimit is true and caller has permission", async () => {
      models.customer.findFirst.mockResolvedValue({ id: "cus_1", creditLimit: 100 });
      models.sale.aggregate.mockResolvedValue({ _sum: { totalAmount: 80, amountPaid: 10 } });
      // Caller has role owner -> has override permission
      models.member.findFirst.mockResolvedValue({ role: "owner" });

      const res = await request(app)
        .post("/api/sales")
        .set(auth())
        .send({ ...validBody, overrideCreditLimit: true });

      expect(res.status).toBe(201);
      expect(models.sale.create).toHaveBeenCalled();
    });

    it("blocks an override attempt when the caller lacks the override permission", async () => {
      // Caller has role sales -> can create sales, but lacks override_credit_limit permission
      models.member.findFirst.mockResolvedValue({ role: "sales" });

      const res = await request(app)
        .post("/api/sales")
        .set(auth())
        .send({ ...validBody, overrideCreditLimit: true });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CREDIT_LIMIT_OVERRIDE_FORBIDDEN");
      expect(res.body.error).toContain("permission to override a customer's credit limit");
      expect(models.sale.create).not.toHaveBeenCalled();
    });

    it("deducts customer return store credits from outstanding balance so returned goods do not falsely block sales", async () => {
      // Customer has creditLimit of 100
      models.customer.findFirst.mockResolvedValue({ id: "cus_1", creditLimit: 100 });
      // Unpaid invoices = 80 - 10 = 70
      models.sale.aggregate.mockResolvedValue({ _sum: { totalAmount: 80, amountPaid: 10 } });
      // Customer returned 30 worth of goods (store credit)
      models.return.findMany.mockResolvedValue([
        {
          items: [
            { quantity: 3, unitPrice: 10, taxAmount: 0, discount: 0 },
          ],
        },
      ]);
      // Net balance is 70 - 30 = 40. New sale total is 50 -> projected = 90 <= 100.
      const res = await request(app).post("/api/sales").set(auth()).send(validBody);

      expect(res.status).toBe(201);
      expect(models.sale.create).toHaveBeenCalled();
    });

    it("deducts unallocated payments from outstanding balance", async () => {
      // Customer has creditLimit of 100
      models.customer.findFirst.mockResolvedValue({ id: "cus_1", creditLimit: 100 });
      // Unpaid invoices = 80 - 10 = 70
      models.sale.aggregate.mockResolvedValue({ _sum: { totalAmount: 80, amountPaid: 10 } });
      // Customer has unallocated payments of 30 on account
      models.payment.aggregate.mockResolvedValue({ _sum: { amount: 30 } });
      // Net balance is 70 - 30 = 40. New sale total is 50 -> projected = 90 <= 100.
      const res = await request(app).post("/api/sales").set(auth()).send(validBody);

      expect(res.status).toBe(201);
      expect(models.sale.create).toHaveBeenCalled();
    });
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
      where: { id: "sal_1", organizationId: ORG, deletedAt: null },
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

  it("refuses to cancel through PUT, sending the caller to the guarded endpoint", async () => {
    const res = await request(app)
      .put("/api/sales/sal_1")
      .set(auth())
      .send({ status: "Cancelled" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USE_CANCEL_ENDPOINT");
    expect(models.sale.update).not.toHaveBeenCalled();
    expect(models.inventory.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to edit an invoice that is cancelled", async () => {
    models.sale.findFirst.mockResolvedValue({ status: "Cancelled" });

    const res = await request(app)
      .put("/api/sales/sal_1")
      .set(auth())
      .send({ status: "Completed" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SALE_IS_CANCELLED");
    expect(models.sale.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/sales/:id", () => {
  it("stamps the invoice, returns its stock, and answers 200", async () => {
    const res = await request(app).delete("/api/sales/sal_1").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("sal_1");
    expect(models.return.count).toHaveBeenCalledWith({
      where: { saleId: "sal_1", organizationId: ORG, deletedAt: null },
    });
    // The two units the invoice took come back, one ledger row each.
    expect(models.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG }),
        data: { quantityOnHand: { increment: 2 } },
      })
    );
    expect(models.inventoryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: "IN",
          quantity: 2,
          reason: "Reversal of sale SAL-001",
        }),
      })
    );
    expect(models.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sal_1", organizationId: ORG },
        data: { deletedAt: expect.any(Date) },
      })
    );
  });

  it("404s for a sale owned by another tenant", async () => {
    models.sale.findFirst.mockResolvedValue(null);

    const res = await request(app).delete("/api/sales/foreign").set(auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("SALE_NOT_FOUND");
    expect(models.sale.update).not.toHaveBeenCalled();
  });

  it("refuses to delete an invoice that has payments", async () => {
    models.sale.findFirst.mockResolvedValue(saleFixture({ amountPaid: 20 }));

    const res = await request(app).delete("/api/sales/sal_1").set(auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SALE_HAS_PAYMENTS");
    expect(models.inventory.update).not.toHaveBeenCalled();
    expect(models.sale.update).not.toHaveBeenCalled();
  });

  it("refuses to delete an invoice with active returns", async () => {
    models.return.count.mockResolvedValue(1);

    const res = await request(app).delete("/api/sales/sal_1").set(auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SALE_HAS_RETURNS");
    expect(models.sale.update).not.toHaveBeenCalled();
  });

  it("refuses to delete an invoice that is already deleted", async () => {
    models.sale.findFirst.mockResolvedValue(saleFixture({ deletedAt: new Date() }));

    const res = await request(app).delete("/api/sales/sal_1").set(auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SALE_ALREADY_DELETED");
    expect(models.inventory.update).not.toHaveBeenCalled();
  });

  it("refuses without a user to attribute the reversal to", async () => {
    vi.stubEnv(USER_ENV_VAR, "");

    const res = await request(app)
      .delete("/api/sales/sal_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(models.sale.findFirst).not.toHaveBeenCalled();
  });
});

describe("POST /api/sales/:id/restore", () => {
  it("refuses without a user to attribute the restoration to", async () => {
    vi.stubEnv(USER_ENV_VAR, "");

    const res = await request(app)
      .post("/api/sales/sal_1/restore")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(models.sale.findFirst).not.toHaveBeenCalled();
  });

  it("re-consumes the stock and clears the stamp", async () => {
    models.sale.findFirst.mockResolvedValue(saleFixture({ deletedAt: new Date() }));

    const res = await request(app).post("/api/sales/sal_1/restore").set(auth());

    expect(res.status).toBe(200);
    expect(models.inventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ quantityOnHand: { gte: 2 } }),
        data: { quantityOnHand: { decrement: 2 } },
      })
    );
    expect(models.inventoryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: "OUT",
          reason: "Restoration of sale SAL-001",
        }),
      })
    );
    expect(models.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sal_1", organizationId: ORG },
        data: { deletedAt: null },
      })
    );
  });

  it("refuses when the stock has been sold on since", async () => {
    models.sale.findFirst.mockResolvedValue(saleFixture({ deletedAt: new Date() }));
    models.inventory.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app).post("/api/sales/sal_1/restore").set(auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STOCK_FOR_RESTORE");
    expect(models.sale.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/sales/:id/cancel and /uncancel", () => {
  it("cancels and remembers the status it came from", async () => {
    const res = await request(app).post("/api/sales/sal_1/cancel").set(auth());

    expect(res.status).toBe(200);
    expect(models.sale.update).toHaveBeenCalledWith({
      where: { id: "sal_1", organizationId: ORG },
      data: { status: "Cancelled", statusBeforeCancel: "Pending" },
      include: { customer: true, items: { include: { product: true } } },
    });
    // Cancelling moves no stock and writes no ledger rows.
    expect(models.inventory.updateMany).not.toHaveBeenCalled();
    expect(models.inventoryLog.create).not.toHaveBeenCalled();
  });

  it("refuses to cancel a paid invoice", async () => {
    models.sale.findFirst.mockResolvedValue(saleFixture({ amountPaid: 20 }));

    const res = await request(app).post("/api/sales/sal_1/cancel").set(auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SALE_HAS_PAYMENTS");
    expect(models.sale.update).not.toHaveBeenCalled();
  });

  it("refuses to cancel an invoice with returns", async () => {
    models.return.count.mockResolvedValue(1);

    const res = await request(app).post("/api/sales/sal_1/cancel").set(auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SALE_HAS_RETURNS");
    expect(models.sale.update).not.toHaveBeenCalled();
  });

  it("uncancels back to the remembered status", async () => {
    models.sale.findFirst.mockResolvedValue(
      saleFixture({ status: "Cancelled", statusBeforeCancel: "Completed" })
    );

    const res = await request(app).post("/api/sales/sal_1/uncancel").set(auth());

    expect(res.status).toBe(200);
    expect(models.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sal_1", organizationId: ORG },
        data: { status: "Completed", statusBeforeCancel: null },
      })
    );
  });

  it("refuses to un-cancel an invoice that is not cancelled", async () => {
    const res = await request(app).post("/api/sales/sal_1/uncancel").set(auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SALE_NOT_CANCELLED");
    expect(models.sale.update).not.toHaveBeenCalled();
  });
});

describe("GET /api/sales/:id/print", () => {
  it("prints the active Company's stored profile in the invoice header", async () => {
    models.companySettings.findUnique.mockResolvedValue({
      organizationId: ORG,
      displayName: "Acme Distribution",
      address: "12 Market Road",
      gstin: "27AAPFU0939F1ZV",
    });

    const res = await request(app).get("/api/sales/sal_1/print").set(auth());

    expect(res.status).toBe(200);
    expect(res.text).toContain("Acme Distribution");
    expect(res.text).toContain("12 Market Road");
    expect(res.text).toContain("GSTIN: 27AAPFU0939F1ZV");
    expect(models.companySettings.findUnique).toHaveBeenCalledWith({
      where: { organizationId: ORG },
    });
  });

  it("falls back to a default issuer when the Company has no profile", async () => {
    const res = await request(app).get("/api/sales/sal_1/print").set(auth());

    expect(res.status).toBe(200);
    expect(res.text).toContain("Distribution Management System");
  });
});
