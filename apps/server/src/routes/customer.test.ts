import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER } from "../middleware/auth-context";

const { customerModel, saleModel, paymentModel, returnModel } = vi.hoisted(() => ({
  customerModel: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  saleModel: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  paymentModel: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  returnModel: {
    findMany: vi.fn(),
  },
}));

vi.mock("@dms/db", () => ({
  default: {
    customer: customerModel,
    sale: saleModel,
    payment: paymentModel,
    return: returnModel,
  },
  prisma: {
    customer: customerModel,
    sale: saleModel,
    payment: paymentModel,
    return: returnModel,
  },
}));

const app = createApp();

const ORG = "org_1";
const OTHER_ORG = "org_2";

const customerFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "cust_1",
  customerCode: "CUST-001",
  organizationId: ORG,
  name: "Acme Retail",
  email: "buyer@acme.test",
  phone: "555-0100",
  address: "1 Market St",
  city: "Karachi",
  creditLimit: 5000,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  _count: { sale: 3 },
  ...overrides,
});

const validBody = {
  customerCode: "CUST-001",
  name: "Acme Retail",
  email: "buyer@acme.test",
  phone: "555-0100",
  address: "1 Market St",
  city: "Karachi",
  creditLimit: 5000,
  isActive: true,
};

const prismaError = (code: string, meta?: Record<string, unknown>) => ({
  code,
  meta,
  name: "PrismaClientKnownRequestError",
});

beforeEach(() => {
  vi.clearAllMocks();
  customerModel.findMany.mockResolvedValue([customerFixture()]);
  customerModel.count.mockResolvedValue(1);
  customerModel.findFirst.mockResolvedValue(customerFixture());
  customerModel.create.mockResolvedValue(customerFixture());
  customerModel.update.mockResolvedValue(customerFixture());
  customerModel.delete.mockResolvedValue(customerFixture());
  saleModel.count.mockResolvedValue(0);
  paymentModel.count.mockResolvedValue(0);
  saleModel.findMany.mockResolvedValue([]);
  paymentModel.findMany.mockResolvedValue([]);
  returnModel.findMany.mockResolvedValue([]);
});

describe("organization context", () => {
  it("rejects requests without an organization and never touches the database", async () => {
    const res = await request(app).get("/api/customers");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(res.body.details).toBeUndefined();
    expect(customerModel.findMany).not.toHaveBeenCalled();
  });

  it("serves the health check without an organization", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/customers", () => {
  it("returns the documented paginated envelope", async () => {
    customerModel.findMany.mockResolvedValue([
      customerFixture({ id: "cust_1" }),
      customerFixture({ id: "cust_2" }),
    ]);
    customerModel.count.mockResolvedValue(45);

    const res = await request(app)
      .get("/api/customers")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(45);
    expect(res.body.pageCount).toBe(3);
  });

  it("scopes the query to the caller's organization and orders by name", async () => {
    await request(app).get("/api/customers").set(ORGANIZATION_HEADER, ORG);

    expect(customerModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG },
        orderBy: { name: "asc" },
        skip: 0,
        take: 20,
      })
    );
    expect(customerModel.count).toHaveBeenCalledWith({
      where: { organizationId: ORG },
    });
  });

  it("coerces page and pageSize into skip and take", async () => {
    await request(app)
      .get("/api/customers?page=3&pageSize=10")
      .set(ORGANIZATION_HEADER, ORG);

    expect(customerModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it("counts against the same filter the page was read with", async () => {
    await request(app)
      .get("/api/customers?search=acme&isActive=false")
      .set(ORGANIZATION_HEADER, ORG);

    const where = {
      organizationId: ORG,
      isActive: false,
      OR: [
        { name: { contains: "acme", mode: "insensitive" } },
        { customerCode: { contains: "acme", mode: "insensitive" } },
      ],
    };

    expect(customerModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where })
    );
    expect(customerModel.count).toHaveBeenCalledWith({ where });
  });

  it("searches name and customer code case-insensitively", async () => {
    await request(app)
      .get("/api/customers?search=Acme")
      .set(ORGANIZATION_HEADER, ORG);

    expect(customerModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "Acme", mode: "insensitive" } },
            { customerCode: { contains: "Acme", mode: "insensitive" } },
          ],
        }),
      })
    );
  });

  it("treats an empty search box as no filter", async () => {
    await request(app)
      .get("/api/customers?search=")
      .set(ORGANIZATION_HEADER, ORG);

    expect(customerModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });

  it("shows active and inactive customers when isActive is absent", async () => {
    await request(app).get("/api/customers").set(ORGANIZATION_HEADER, ORG);

    expect(customerModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });

  it.each(["true", "false"])("filters on isActive=%s", async (value) => {
    await request(app)
      .get(`/api/customers?isActive=${value}`)
      .set(ORGANIZATION_HEADER, ORG);

    expect(customerModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, isActive: value === "true" },
      })
    );
  });

  it("does not read isActive=false as true", async () => {
    await request(app)
      .get("/api/customers?isActive=false")
      .set(ORGANIZATION_HEADER, ORG);

    expect(customerModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG, isActive: false } })
    );
  });

  it("rejects an isActive that is neither true nor false", async () => {
    const res = await request(app)
      .get("/api/customers?isActive=yes")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(customerModel.findMany).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric page instead of coercing it to 1", async () => {
    const res = await request(app)
      .get("/api/customers?page=abc")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(customerModel.findMany).not.toHaveBeenCalled();
  });

  it("sends a sale count instead of the customer's whole sales history", async () => {
    await request(app).get("/api/customers").set(ORGANIZATION_HEADER, ORG);

    const { include } = customerModel.findMany.mock.calls[0][0];

    expect(include).toEqual({ _count: { select: { sale: { where: { deletedAt: null } } } } });
  });
});

describe("GET /api/customers/:id", () => {
  it("returns the customer", async () => {
    const res = await request(app)
      .get("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("cust_1");
  });

  it("looks the customer up by id within the caller's organization", async () => {
    await request(app)
      .get("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(customerModel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "cust_1", organizationId: ORG } })
    );
  });

  it("sends a sale count instead of the customer's whole sales history", async () => {
    await request(app)
      .get("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG);

    const { include } = customerModel.findFirst.mock.calls[0][0];

    expect(include).toEqual({ _count: { select: { sale: { where: { deletedAt: null } } } } });
  });

  it("404s when the customer belongs to another organization", async () => {
    customerModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/customers/cust_9")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CUSTOMER_NOT_FOUND");
  });

  it("404s a blank id rather than falling back to an unscoped read", async () => {
    customerModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/customers/%20")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(404);
    expect(customerModel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: " ", organizationId: ORG } })
    );
  });
});

describe("POST /api/customers", () => {
  it("creates the customer under the caller's organization", async () => {
    const res = await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("cust_1");
    expect(customerModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerCode: "CUST-001",
          name: "Acme Retail",
          organizationId: ORG,
        }),
      })
    );
  });

  it("ignores any organization in the body", async () => {
    await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, organizationId: OTHER_ORG });

    const { data } = customerModel.create.mock.calls[0][0];

    expect(data.organizationId).toBe(ORG);
  });

  it("defaults isActive to true", async () => {
    await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ customerCode: "CUST-002", name: "Beta" });

    const { data } = customerModel.create.mock.calls[0][0];

    expect(data.isActive).toBe(true);
  });

  it("sends no value for optional fields the body omitted", async () => {
    await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ customerCode: "CUST-002", name: "Beta" });

    const { data } = customerModel.create.mock.calls[0][0];

    // Prisma omits a column it was not given, and these columns default to null,
    // so the record ends up with no value for them.
    expect(data.email).toBeUndefined();
    expect(data.phone).toBeUndefined();
    expect(data.address).toBeUndefined();
    expect(data.city).toBeUndefined();
    expect(data.creditLimit).toBeUndefined();
  });

  it("clears a blanked optional field on create", async () => {
    await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, email: "", phone: "", creditLimit: "" });

    const { data } = customerModel.create.mock.calls[0][0];

    expect(data.email).toBeNull();
    expect(data.phone).toBeNull();
    expect(data.creditLimit).toBeNull();
  });

  it("keeps a credit limit of 0 instead of recording no limit", async () => {
    await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, creditLimit: 0 });

    const { data } = customerModel.create.mock.calls[0][0];

    expect(data.creditLimit).toBe(0);
  });

  it("accepts a credit limit sent as a numeric string", async () => {
    await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, creditLimit: "7500.50" });

    const { data } = customerModel.create.mock.calls[0][0];

    expect(data.creditLimit).toBe(7500.5);
  });

  it("treats a blank credit limit as no limit recorded", async () => {
    await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, creditLimit: "" });

    const { data } = customerModel.create.mock.calls[0][0];

    expect(data.creditLimit).toBeNull();
  });

  it("treats a whitespace-only email as no email recorded", async () => {
    await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, email: "   " });

    const { data } = customerModel.create.mock.calls[0][0];

    expect(data.email).toBeNull();
  });

  it("trims the fields it stores", async () => {
    await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, customerCode: "  CUST-009  ", name: "  Gamma  " });

    const { data } = customerModel.create.mock.calls[0][0];

    expect(data.customerCode).toBe("CUST-009");
    expect(data.name).toBe("Gamma");
  });

  it.each([
    ["a blank customer code", { customerCode: "   " }, "customerCode"],
    ["a blank name", { name: "   " }, "name"],
    ["a malformed email", { email: "not-an-email" }, "email"],
    ["a negative credit limit", { creditLimit: -1 }, "creditLimit"],
    ["a non-numeric credit limit", { creditLimit: "abc" }, "creditLimit"],
  ])("rejects %s", async (_label, patch, field) => {
    const res = await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, ...patch });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.details.fieldErrors)).toContain(field);
    expect(customerModel.create).not.toHaveBeenCalled();
  });

  it("rejects a request with no body", async () => {
    const res = await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(customerModel.create).not.toHaveBeenCalled();
  });

  it("409s on a duplicate customer code", async () => {
    customerModel.create.mockRejectedValue(
      prismaError("P2002", { target: ["customerCode"] })
    );

    const res = await request(app)
      .post("/api/customers")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIQUE_CONSTRAINT");
  });
});

describe("PUT /api/customers/:id", () => {
  it("updates the customer within the caller's organization", async () => {
    const res = await request(app)
      .put("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Acme Retail Ltd" });

    expect(res.status).toBe(200);
    expect(customerModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cust_1", organizationId: ORG },
        data: { name: "Acme Retail Ltd" },
      })
    );
  });

  it("cannot re-point the customer at another organization", async () => {
    await request(app)
      .put("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Acme", organizationId: OTHER_ORG, id: "cust_9" });

    const args = customerModel.update.mock.calls[0][0];

    expect(args.data).toEqual({ name: "Acme" });
    expect(args.where).toEqual({ id: "cust_1", organizationId: ORG });
  });

  it("leaves isActive alone when the update omits it", async () => {
    await request(app)
      .put("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Acme" });

    const { data } = customerModel.update.mock.calls[0][0];

    expect(data).not.toHaveProperty("isActive");
  });

  it("deactivates a customer when asked", async () => {
    await request(app)
      .put("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ isActive: false });

    const { data } = customerModel.update.mock.calls[0][0];

    expect(data).toEqual({ isActive: false });
  });

  it("stores a credit limit of 0 as 0", async () => {
    await request(app)
      .put("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ creditLimit: 0 });

    const { data } = customerModel.update.mock.calls[0][0];

    expect(data).toEqual({ creditLimit: 0 });
  });

  it("clears the credit limit when it is blanked out", async () => {
    await request(app)
      .put("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ creditLimit: "" });

    const { data } = customerModel.update.mock.calls[0][0];

    expect(data).toEqual({ creditLimit: null });
  });

  it("clears optional fields when they are blanked out", async () => {
    await request(app)
      .put("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ email: "", phone: "", city: "" });

    const { data } = customerModel.update.mock.calls[0][0];

    expect(data).toEqual({ email: null, phone: null, city: null });
  });

  it.each([
    ["a blank customer code", { customerCode: "   " }, "customerCode"],
    ["a malformed email", { email: "nope" }, "email"],
    ["a negative credit limit", { creditLimit: -5 }, "creditLimit"],
    ["a non-boolean isActive", { isActive: "false" }, "isActive"],
  ])("rejects %s", async (_label, patch, field) => {
    const res = await request(app)
      .put("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send(patch);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.details.fieldErrors)).toContain(field);
    expect(customerModel.update).not.toHaveBeenCalled();
  });

  it("404s when the customer belongs to another organization", async () => {
    customerModel.update.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .put("/api/customers/cust_9")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Acme" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /api/customers/:id", () => {
  it("deletes the customer and answers 204", async () => {
    const res = await request(app)
      .delete("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("deletes within the caller's organization", async () => {
    await request(app)
      .delete("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(customerModel.delete).toHaveBeenCalledWith({
      where: { id: "cust_1", organizationId: ORG },
    });
  });

  it("checks for sales inside the caller's organization", async () => {
    await request(app)
      .delete("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(saleModel.count).toHaveBeenCalledWith({
      where: { customerId: "cust_1", organizationId: ORG },
    });
  });

  it("refuses to delete a customer with sales history", async () => {
    saleModel.count.mockResolvedValue(4);

    const res = await request(app)
      .delete("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CUSTOMER_HAS_SALES");
    expect(res.body.details).toEqual({ saleCount: 4 });
    expect(customerModel.delete).not.toHaveBeenCalled();
  });

  it("checks for payments inside the caller's organization", async () => {
    await request(app)
      .delete("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(paymentModel.count).toHaveBeenCalledWith({
      where: { customerId: "cust_1", organizationId: ORG },
    });
  });

  it("refuses to delete a customer with payments on record", async () => {
    paymentModel.count.mockResolvedValue(2);

    const res = await request(app)
      .delete("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CUSTOMER_HAS_PAYMENTS");
    expect(res.body.details).toEqual({ paymentCount: 2 });
    expect(customerModel.delete).not.toHaveBeenCalled();
  });

  it("does not report a foreign key violation for a customer with sales", async () => {
    saleModel.count.mockResolvedValue(1);

    const res = await request(app)
      .delete("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.body.code).not.toBe("FOREIGN_KEY_VIOLATION");
  });

  it("deletes a customer that has never been billed", async () => {
    saleModel.count.mockResolvedValue(0);

    const res = await request(app)
      .delete("/api/customers/cust_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(204);
    expect(customerModel.delete).toHaveBeenCalledTimes(1);
  });

  it("404s when the customer belongs to another organization", async () => {
    customerModel.delete.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .delete("/api/customers/cust_9")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});

describe("GET /api/customers/:id/ledger", () => {
  it("404s for a customer from another organization", async () => {
    customerModel.findFirst.mockResolvedValue(null);

    const res = await request(app).get("/api/customers/cust_9/ledger").set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CUSTOMER_NOT_FOUND");
    expect(saleModel.findMany).not.toHaveBeenCalled();
  });

  it("scopes invoices, credits and payments to this customer in this tenant", async () => {
    const res = await request(app)
      .get("/api/customers/cust_1/ledger")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      openingBalance: 0,
      entries: [],
      totals: { invoices: 0, credits: 0, payments: 0, closingBalance: 0 },
    });
    expect(saleModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          customerId: "cust_1",
          deletedAt: null,
          status: { not: "Cancelled" },
        },
      })
    );
    expect(returnModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG,
          returnType: "SALE",
          deletedAt: null,
        }),
      })
    );
    expect(paymentModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, customerId: "cust_1", deletedAt: null },
      })
    );
  });

  it("applies the statement window, with everything before it as opening balance", async () => {
    await request(app)
      .get("/api/customers/cust_1/ledger?from=2026-01-01&to=2026-01-31")
      .set(ORGANIZATION_HEADER, ORG);

    // Each document type is read twice: once for the opening balance (strictly
    // before `from`) and once for the window itself.
    const openingSales = saleModel.findMany.mock.calls[0][0].where;
    expect(openingSales.saleDate).toEqual({ lt: new Date("2026-01-01") });

    const windowSales = saleModel.findMany.mock.calls[1][0].where;
    expect(windowSales.saleDate).toEqual({
      gte: new Date("2026-01-01"),
      // `to` is inclusive of the whole day it names.
      lt: new Date("2026-02-01"),
    });

    const windowPayments = paymentModel.findMany.mock.calls[1][0].where;
    expect(windowPayments.paidAt).toEqual({
      gte: new Date("2026-01-01"),
      lt: new Date("2026-02-01"),
    });
  });

  it("computes a running balance from invoices, credits and payments", async () => {
    customerModel.findFirst.mockResolvedValue({
      id: "cust_1",
      customerCode: "CUST-001",
      name: "Acme Retail",
      phone: "555-0100",
    });
    saleModel.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { saleCode: "SAL-001", saleDate: new Date("2026-01-05T00:00:00.000Z"), totalAmount: 100 },
      { saleCode: "SAL-002", saleDate: new Date("2026-01-10T00:00:00.000Z"), totalAmount: 50 },
    ]);
    returnModel.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        returnCode: "RET-001",
        returnDate: new Date("2026-01-06T00:00:00.000Z"),
        items: [{ quantity: 1, unitPrice: 20, taxAmount: 0, discount: 0 }],
      },
    ]);
    paymentModel.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { paymentCode: "PMT-001", paidAt: new Date("2026-01-07T00:00:00.000Z"), amount: 60, method: "Cash" },
    ]);

    const res = await request(app)
      .get("/api/customers/cust_1/ledger?from=2026-01-01&to=2026-01-31")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([
      expect.objectContaining({ type: "invoice", reference: "SAL-001", debit: 100, balance: 100 }),
      expect.objectContaining({ type: "credit", reference: "RET-001", credit: 20, balance: 80 }),
      expect.objectContaining({ type: "payment", reference: "PMT-001", credit: 60, balance: 20 }),
      expect.objectContaining({ type: "invoice", reference: "SAL-002", debit: 50, balance: 70 }),
    ]);
    expect(res.body.totals).toEqual({
      invoices: 150,
      credits: 20,
      payments: 60,
      closingBalance: 70,
    });
  });
});
