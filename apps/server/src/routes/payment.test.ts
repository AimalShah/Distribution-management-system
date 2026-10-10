import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER, USER_ENV_VAR, USER_HEADER } from "../middleware/auth-context";

const { models, transaction } = vi.hoisted(() => {
  const models = {
    member: { findFirst: async () => ({ role: "owner" }) },
    payment: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    customer: { findFirst: vi.fn() },
    return: { findMany: vi.fn() },
    sale: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  // `$transaction` hands the callback a transaction-scoped client; here the
  // same model doubles stand in for it, and the callback's result is awaited.
  const transaction = vi.fn(
    async (callback: (tx: typeof models) => Promise<unknown>) => callback(models)
  );

  return { models, transaction };
});

vi.mock("@dms/db", () => ({
  default: { ...models, $transaction: transaction },
  prisma: { ...models, $transaction: transaction },
}));

vi.mock("../services/payment-pdf", () => ({
  generatePaymentPdf: vi.fn(async () => Buffer.from("%PDF-1.4 mock payment")),
}));

vi.mock("../services/settings", () => ({
  getCompanySettings: vi.fn(async () => ({
    displayName: "Mock Company",
    address: "123 Market St",
    gstin: "27AAAAA0000A1Z5",
    phone: "555-0199",
    email: "billing@mock.com",
  })),
}));

const app = createApp();

const ORG = "org_1";

const USER = "user_1";

const auth = () => ({
  [ORGANIZATION_HEADER]: ORG,
  [USER_HEADER]: USER,
});

const paymentFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "pay_1",
  paymentCode: "PMT-001",
  organizationId: ORG,
  customerId: "cus_1",
  saleId: "sal_1",
  amount: 25,
  method: "Cash",
  reference: null,
  note: null,
  paidAt: new Date("2026-01-02T00:00:00.000Z"),
  userId: USER,
  deletedAt: null,
  customer: { id: "cus_1", customerCode: "CUST-001", name: "Acme", phone: "555-0100" },
  sale: { id: "sal_1", saleCode: "SAL-001", totalAmount: 100, amountPaid: 25, status: "Pending" },
  user: { name: "Member", email: "member@example.test" },
  ...overrides,
});

const validBody = {
  paymentCode: "PMT-001",
  customerId: "cus_1",
  saleId: "sal_1",
  amount: 25,
  method: "Cash",
};

const saleFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "sal_1",
  saleCode: "SAL-001",
  customerId: "cus_1",
  status: "Pending",
  totalAmount: 100,
  amountPaid: 0,
  deletedAt: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  models.payment.findMany.mockResolvedValue([paymentFixture()]);
  models.payment.count.mockResolvedValue(1);
  models.payment.findFirst.mockResolvedValue(paymentFixture());
  models.payment.create.mockResolvedValue(paymentFixture());
  models.payment.update.mockResolvedValue(paymentFixture());
  models.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  models.customer.findFirst.mockResolvedValue({ id: "cus_1" });
  models.return.findMany.mockResolvedValue([]);
  models.sale.findFirst.mockResolvedValue(saleFixture());
  models.sale.updateMany.mockResolvedValue({ count: 1 });
  models.sale.update.mockResolvedValue(saleFixture());
});

describe("organization context", () => {
  it("rejects a request without an organization and never touches the database", async () => {
    const res = await request(app).get("/api/payments");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(models.payment.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/payments", () => {
  it("lists live payments for the caller's organization, newest first", async () => {
    const res = await request(app).get("/api/payments").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(models.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, deletedAt: null },
        orderBy: { paidAt: "desc" },
      })
    );
  });

  it("shows corrected payments only when asked", async () => {
    await request(app).get("/api/payments?deleted=true").set(auth());

    expect(models.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, deletedAt: { not: null } },
      })
    );
  });

  it("filters by customer and by invoice", async () => {
    await request(app)
      .get("/api/payments?customerId=cus_1&saleId=sal_1")
      .set(auth());

    expect(models.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, deletedAt: null, customerId: "cus_1", saleId: "sal_1" },
      })
    );
  });
});

describe("POST /api/payments", () => {
  it("refuses without a user to attribute the money to", async () => {
    vi.stubEnv(USER_ENV_VAR, "");

    const res = await request(app)
      .post("/api/payments")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(models.payment.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive amount", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set(auth())
      .send({ ...validBody, amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(models.payment.create).not.toHaveBeenCalled();
  });

  it("records the payment against the invoice and advances the paid total", async () => {
    const res = await request(app).post("/api/payments").set(auth()).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.paymentCode).toBe("PMT-001");
    expect(models.sale.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "sal_1", organizationId: ORG }),
        data: { amountPaid: { increment: 25 } },
      })
    );
    expect(models.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG,
          customerId: "cus_1",
          saleId: "sal_1",
          amount: 25,
          userId: USER,
        }),
      })
    );
  });

  it("allows the payment that settles a partially paid invoice", async () => {
    // The guard threshold is `totalAmount - amount` (what the row may reach),
    // not `remaining - amount`, which would double-subtract the paid portion
    // and refuse to ever settle an invoice paid past half.
    models.sale.findFirst.mockResolvedValue(saleFixture({ amountPaid: 60 }));

    const res = await request(app)
      .post("/api/payments")
      .set(auth())
      .send({ ...validBody, amount: 40 });

    expect(res.status).toBe(201);
    expect(models.sale.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ amountPaid: { lte: 60 } }),
      })
    );
  });

  it("records cash on account when no invoice is named", async () => {
    const { saleId: _saleId, ...onAccount } = validBody;

    const res = await request(app).post("/api/payments").set(auth()).send(onAccount);

    expect(res.status).toBe(201);
    expect(models.sale.updateMany).not.toHaveBeenCalled();
    expect(models.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ saleId: null }),
      })
    );
  });

  it("refuses an invoice from another organization", async () => {
    models.sale.findFirst.mockResolvedValue(null);

    const res = await request(app).post("/api/payments").set(auth()).send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SALE_NOT_IN_ORGANIZATION");
    expect(models.payment.create).not.toHaveBeenCalled();
  });

  it("refuses an invoice that belongs to a different customer", async () => {
    models.sale.findFirst.mockResolvedValue(saleFixture({ customerId: "cus_other" }));

    const res = await request(app).post("/api/payments").set(auth()).send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SALE_CUSTOMER_MISMATCH");
    expect(models.payment.create).not.toHaveBeenCalled();
  });

  it("refuses a payment that would take the invoice past its total", async () => {
    // The guarded update matched no row: someone else settled the balance
    // between the read and the write.
    models.sale.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app).post("/api/payments").set(auth()).send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PAYMENT_EXCEEDS_BALANCE");
    expect(models.payment.create).not.toHaveBeenCalled();
  });

  it("refuses a cancelled invoice", async () => {
    models.sale.findFirst.mockResolvedValue(saleFixture({ status: "Cancelled" }));

    const res = await request(app).post("/api/payments").set(auth()).send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SALE_CANCELLED");
    expect(models.payment.create).not.toHaveBeenCalled();
  });

  it("records a payment with method Store Credit when customer has available store credit", async () => {
    models.return.findMany.mockResolvedValue([
      {
        items: [{ quantity: 3, unitPrice: 10, taxAmount: 0, discount: 0 }],
      },
    ]);
    models.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    const res = await request(app)
      .post("/api/payments")
      .set(auth())
      .send({ ...validBody, method: "Store Credit", amount: 30 });

    expect(res.status).toBe(201);
    expect(models.sale.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { amountPaid: { increment: 30 } },
      })
    );
    expect(models.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          method: "Store Credit",
          amount: 30,
        }),
      })
    );
  });

  it("refuses a Store Credit payment when customer has insufficient store credit balance", async () => {
    models.return.findMany.mockResolvedValue([
      {
        items: [{ quantity: 1, unitPrice: 10, taxAmount: 0, discount: 0 }],
      },
    ]);
    models.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    const res = await request(app)
      .post("/api/payments")
      .set(auth())
      .send({ ...validBody, method: "Store Credit", amount: 25 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STORE_CREDIT");
    expect(res.body.details).toEqual({ available: 10, requested: 25 });
    expect(models.payment.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/payments/:id", () => {
  it("stamps the correction and takes the money back off the invoice", async () => {
    const res = await request(app).delete("/api/payments/pay_1").set(auth());

    expect(res.status).toBe(200);
    expect(models.sale.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "sal_1", amountPaid: { gte: 25 } }),
        data: { amountPaid: { decrement: 25 } },
      })
    );
    expect(models.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay_1", organizationId: ORG },
        data: { deletedAt: expect.any(Date) },
      })
    );
  });

  it("404s for a payment owned by another tenant", async () => {
    models.payment.findFirst.mockResolvedValue(null);

    const res = await request(app).delete("/api/payments/foreign").set(auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PAYMENT_NOT_FOUND");
    expect(models.payment.update).not.toHaveBeenCalled();
  });

  it("refuses to correct the same payment twice", async () => {
    models.payment.findFirst.mockResolvedValue(paymentFixture({ deletedAt: new Date() }));

    const res = await request(app).delete("/api/payments/pay_1").set(auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PAYMENT_ALREADY_DELETED");
    expect(models.payment.update).not.toHaveBeenCalled();
  });

  it("refuses when the invoice no longer carries the balance", async () => {
    models.sale.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app).delete("/api/payments/pay_1").set(auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PAYMENT_BALANCE_UNDERFLOW");
    expect(models.payment.update).not.toHaveBeenCalled();
  });

  it("corrects cash on account without touching any invoice", async () => {
    models.payment.findFirst.mockResolvedValue(paymentFixture({ saleId: null }));

    const res = await request(app).delete("/api/payments/pay_1").set(auth());

    expect(res.status).toBe(200);
    expect(models.sale.updateMany).not.toHaveBeenCalled();
    expect(models.payment.update).toHaveBeenCalled();
  });
});

describe("GET /api/payments/:id/pdf", () => {
  it("generates a payment collection receipt PDF with inline content-disposition header", async () => {
    const res = await request(app)
      .get("/api/payments/pay_1/pdf")
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/pdf/);
    expect(res.headers["content-disposition"]).toBe(
      'inline; filename="receipt-pay_1.pdf"'
    );
  });

  it("returns 404 when payment does not exist", async () => {
    models.payment.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/payments/pay_missing/pdf")
      .set(auth());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PAYMENT_NOT_FOUND");
  });
});

describe("GET /api/payments/:id/html", () => {
  it("renders payment receipt HTML template cleanly", async () => {
    const res = await request(app)
      .get("/api/payments/pay_1/html")
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toContain("OFFICIAL RECEIPT");
  });
});

