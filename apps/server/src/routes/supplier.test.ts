import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER } from "../middleware/auth-context";

const { supplierModel, purchaseModel } = vi.hoisted(() => ({
  supplierModel: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  purchaseModel: {
    count: vi.fn(),
  },
}));

vi.mock("@dms/db", () => ({
  default: { supplier: supplierModel, purchase: purchaseModel },
  prisma: { supplier: supplierModel, purchase: purchaseModel },
}));

const app = createApp();

const ORG = "org_1";
const OTHER_ORG = "org_2";

const supplierFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "sup_1",
  supplierCode: "SUP-001",
  organizationId: ORG,
  contactPerson: "Jane Okafor",
  companyName: "Acme Distribution",
  email: "orders@acme.test",
  phone: "5550199",
  address: "1 Warehouse Way",
  city: "Karachi",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  _count: { purchase: 5 },
  ...overrides,
});

const validBody = {
  supplierCode: "SUP-001",
  contactPerson: "Jane Okafor",
  companyName: "Acme Distribution",
  email: "orders@acme.test",
  phone: "5550199",
  address: "1 Warehouse Way",
  city: "Karachi",
  isActive: true,
};

const prismaError = (code: string, meta?: Record<string, unknown>) => ({
  code,
  meta,
  name: "PrismaClientKnownRequestError",
});

beforeEach(() => {
  vi.clearAllMocks();
  supplierModel.findMany.mockResolvedValue([supplierFixture()]);
  supplierModel.count.mockResolvedValue(1);
  supplierModel.findFirst.mockResolvedValue(supplierFixture());
  supplierModel.create.mockResolvedValue(supplierFixture());
  supplierModel.update.mockResolvedValue(supplierFixture());
  supplierModel.delete.mockResolvedValue(supplierFixture());
  purchaseModel.count.mockResolvedValue(0);
});

describe("organization context", () => {
  it("rejects requests without an organization and never touches the database", async () => {
    const res = await request(app).get("/api/suppliers");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(res.body.details).toBeUndefined();
    expect(supplierModel.findMany).not.toHaveBeenCalled();
  });

  it("serves the health check without an organization", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/suppliers", () => {
  it("returns the documented paginated envelope", async () => {
    supplierModel.findMany.mockResolvedValue([
      supplierFixture({ id: "sup_1" }),
      supplierFixture({ id: "sup_2" }),
    ]);
    supplierModel.count.mockResolvedValue(45);

    const res = await request(app)
      .get("/api/suppliers")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(45);
    expect(res.body.pageCount).toBe(3);
  });

  it("scopes the query to the caller's organization and orders by company name", async () => {
    await request(app).get("/api/suppliers").set(ORGANIZATION_HEADER, ORG);

    expect(supplierModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG },
        orderBy: { companyName: "asc" },
        skip: 0,
        take: 20,
      })
    );
    expect(supplierModel.count).toHaveBeenCalledWith({
      where: { organizationId: ORG },
    });
  });

  it("coerces page and pageSize into skip and take", async () => {
    await request(app)
      .get("/api/suppliers?page=3&pageSize=10")
      .set(ORGANIZATION_HEADER, ORG);

    expect(supplierModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it("searches company name, code and contact person", async () => {
    await request(app)
      .get("/api/suppliers?search=acme")
      .set(ORGANIZATION_HEADER, ORG);

    const where = {
      organizationId: ORG,
      OR: [
        { companyName: { contains: "acme", mode: "insensitive" } },
        { supplierCode: { contains: "acme", mode: "insensitive" } },
        { contactPerson: { contains: "acme", mode: "insensitive" } },
      ],
    };

    expect(supplierModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where })
    );
    expect(supplierModel.count).toHaveBeenCalledWith({ where });
  });

  it("treats an empty search box as no filter", async () => {
    await request(app)
      .get("/api/suppliers?search=")
      .set(ORGANIZATION_HEADER, ORG);

    expect(supplierModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });

  it("shows active and inactive suppliers when isActive is absent", async () => {
    await request(app).get("/api/suppliers").set(ORGANIZATION_HEADER, ORG);

    expect(supplierModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });

  it.each(["true", "false"])("filters on isActive=%s", async (value) => {
    await request(app)
      .get(`/api/suppliers?isActive=${value}`)
      .set(ORGANIZATION_HEADER, ORG);

    expect(supplierModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, isActive: value === "true" },
      })
    );
  });

  it("does not read isActive=false as true", async () => {
    await request(app)
      .get("/api/suppliers?isActive=false")
      .set(ORGANIZATION_HEADER, ORG);

    expect(supplierModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG, isActive: false } })
    );
  });

  it("rejects an isActive that is neither true nor false", async () => {
    const res = await request(app)
      .get("/api/suppliers?isActive=yes")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(supplierModel.findMany).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric page instead of coercing it to 1", async () => {
    const res = await request(app)
      .get("/api/suppliers?page=abc")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(supplierModel.findMany).not.toHaveBeenCalled();
  });

  it("sends a purchase count instead of the supplier's whole purchase history", async () => {
    await request(app).get("/api/suppliers").set(ORGANIZATION_HEADER, ORG);

    const { include } = supplierModel.findMany.mock.calls[0][0];

    expect(include).toEqual({ _count: { select: { purchase: true } } });
  });
});

describe("GET /api/suppliers/:id", () => {
  it("returns the supplier", async () => {
    const res = await request(app)
      .get("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("sup_1");
  });

  it("looks the supplier up by id within the caller's organization", async () => {
    await request(app)
      .get("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(supplierModel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sup_1", organizationId: ORG } })
    );
  });

  it("no longer embeds the whole purchase history", async () => {
    // The legacy detail embedded `purchase: true` against a `Purchase[]` relation,
    // so the response grew with every purchase the supplier had ever been billed
    // on and never stopped. The history is reachable, paginated, at
    // `GET /api/purchases/supplier/:supplierId`; the count is already on the list
    // row. What the detail route must not do is carry it inline.
    await request(app)
      .get("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG);

    const { include } = supplierModel.findFirst.mock.calls[0][0];

    expect(include).not.toHaveProperty("purchase");
  });

  it("404s when the supplier belongs to another organization", async () => {
    supplierModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/suppliers/sup_9")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("SUPPLIER_NOT_FOUND");
  });
});

describe("POST /api/suppliers", () => {
  it("creates the supplier under the caller's organization", async () => {
    const res = await request(app)
      .post("/api/suppliers")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("sup_1");
    expect(supplierModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supplierCode: "SUP-001",
          companyName: "Acme Distribution",
          organizationId: ORG,
        }),
      })
    );
  });

  it("ignores any organization in the body", async () => {
    await request(app)
      .post("/api/suppliers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, organizationId: OTHER_ORG });

    const { data } = supplierModel.create.mock.calls[0][0];

    expect(data.organizationId).toBe(ORG);
  });

  it("defaults isActive to true", async () => {
    await request(app)
      .post("/api/suppliers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ supplierCode: "SUP-002", companyName: "Beta", contactPerson: "Al" });

    const { data } = supplierModel.create.mock.calls[0][0];

    expect(data.isActive).toBe(true);
  });

  it("creates a supplier with no phone, address or city", async () => {
    await request(app)
      .post("/api/suppliers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ supplierCode: "SUP-002", companyName: "Beta", contactPerson: "Al" });

    expect(supplierModel.create).toHaveBeenCalledTimes(1);
  });

  it("sends no value for optional fields the body omitted", async () => {
    await request(app)
      .post("/api/suppliers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ supplierCode: "SUP-002", companyName: "Beta", contactPerson: "Al" });

    const { data } = supplierModel.create.mock.calls[0][0];

    // Prisma omits a column it was not given, and these columns default to null.
    expect(data.email).toBeUndefined();
    expect(data.phone).toBeUndefined();
    expect(data.address).toBeUndefined();
    expect(data.city).toBeUndefined();
  });

  it("clears a blanked optional field on create", async () => {
    await request(app)
      .post("/api/suppliers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, email: "", phone: "", city: "" });

    const { data } = supplierModel.create.mock.calls[0][0];

    expect(data.email).toBeNull();
    expect(data.phone).toBeNull();
    expect(data.city).toBeNull();
  });

  it("trims the fields it stores", async () => {
    await request(app)
      .post("/api/suppliers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, supplierCode: "  SUP-009  ", companyName: "  Gamma  " });

    const { data } = supplierModel.create.mock.calls[0][0];

    expect(data.supplierCode).toBe("SUP-009");
    expect(data.companyName).toBe("Gamma");
  });

  it("treats a whitespace-only email as no email recorded", async () => {
    await request(app)
      .post("/api/suppliers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, email: "   " });

    const { data } = supplierModel.create.mock.calls[0][0];

    expect(data.email).toBeNull();
  });

  it.each([
    ["a one character supplier code", { supplierCode: "S" }, "supplierCode"],
    ["a one character company name", { companyName: "A" }, "companyName"],
    ["a one character contact person", { contactPerson: "J" }, "contactPerson"],
    ["a blank company name", { companyName: "   " }, "companyName"],
    ["a malformed email", { email: "not-an-email" }, "email"],
  ])("rejects %s", async (_label, patch, field) => {
    const res = await request(app)
      .post("/api/suppliers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, ...patch });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.details.fieldErrors)).toContain(field);
    expect(supplierModel.create).not.toHaveBeenCalled();
  });

  it("rejects a request with no body", async () => {
    const res = await request(app)
      .post("/api/suppliers")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(supplierModel.create).not.toHaveBeenCalled();
  });

  it("409s on a duplicate supplier code", async () => {
    supplierModel.create.mockRejectedValue(
      prismaError("P2002", { target: ["supplierCode"] })
    );

    const res = await request(app)
      .post("/api/suppliers")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIQUE_CONSTRAINT");
  });
});

describe("PUT /api/suppliers/:id", () => {
  it("updates the supplier within the caller's organization", async () => {
    const res = await request(app)
      .put("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ companyName: "Acme Distribution Ltd" });

    expect(res.status).toBe(200);
    expect(supplierModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sup_1", organizationId: ORG },
        data: { companyName: "Acme Distribution Ltd" },
      })
    );
  });

  it("answers with the updated supplier rather than only a message", async () => {
    supplierModel.update.mockResolvedValue(
      supplierFixture({ companyName: "Acme Distribution Ltd" })
    );

    const res = await request(app)
      .put("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ companyName: "Acme Distribution Ltd" });

    expect(res.body).toMatchObject({
      id: "sup_1",
      companyName: "Acme Distribution Ltd",
    });
  });

  it("uses a single-row update rather than a many-row count", async () => {
    await request(app)
      .put("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ companyName: "Acme" });

    expect(supplierModel.update).toHaveBeenCalledTimes(1);
    expect(supplierModel.findFirst).not.toHaveBeenCalled();
  });

  it("cannot re-point the supplier at another organization", async () => {
    await request(app)
      .put("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ companyName: "Acme", organizationId: OTHER_ORG, id: "sup_9" });

    const args = supplierModel.update.mock.calls[0][0];

    expect(args.data).toEqual({ companyName: "Acme" });
    expect(args.where).toEqual({ id: "sup_1", organizationId: ORG });
  });

  it("leaves isActive alone when the update omits it", async () => {
    await request(app)
      .put("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ companyName: "Acme" });

    const { data } = supplierModel.update.mock.calls[0][0];

    expect(data).not.toHaveProperty("isActive");
  });

  it("deactivates a supplier when asked", async () => {
    await request(app)
      .put("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ isActive: false });

    const { data } = supplierModel.update.mock.calls[0][0];

    expect(data).toEqual({ isActive: false });
  });

  it("clears a blanked optional field", async () => {
    await request(app)
      .put("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ email: "", phone: "", address: "", city: "" });

    const { data } = supplierModel.update.mock.calls[0][0];

    expect(data).toEqual({ email: null, phone: null, address: null, city: null });
  });

  it("leaves an optional field alone when the body omits it", async () => {
    await request(app)
      .put("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ companyName: "Acme" });

    const { data } = supplierModel.update.mock.calls[0][0];

    expect(data).toEqual({ companyName: "Acme" });
  });

  it.each([
    ["a one character supplier code", { supplierCode: "S" }, "supplierCode"],
    ["a malformed email", { email: "nope" }, "email"],
    ["a non-boolean isActive", { isActive: "false" }, "isActive"],
  ])("rejects %s", async (_label, patch, field) => {
    const res = await request(app)
      .put("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send(patch);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.details.fieldErrors)).toContain(field);
    expect(supplierModel.update).not.toHaveBeenCalled();
  });

  it("404s when the supplier belongs to another organization", async () => {
    supplierModel.update.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .put("/api/suppliers/sup_9")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ companyName: "Acme" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /api/suppliers/:id", () => {
  it("deletes the supplier and answers 204", async () => {
    const res = await request(app)
      .delete("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("deletes within the caller's organization", async () => {
    await request(app)
      .delete("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(supplierModel.delete).toHaveBeenCalledWith({
      where: { id: "sup_1", organizationId: ORG },
    });
  });

  it("checks for purchases inside the caller's organization", async () => {
    await request(app)
      .delete("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(purchaseModel.count).toHaveBeenCalledWith({
      where: { supplierId: "sup_1", organizationId: ORG },
    });
  });

  it("refuses to delete a supplier with purchase history", async () => {
    purchaseModel.count.mockResolvedValue(7);

    const res = await request(app)
      .delete("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SUPPLIER_HAS_PURCHASES");
    expect(res.body.details).toEqual({ purchaseCount: 7 });
    expect(supplierModel.delete).not.toHaveBeenCalled();
  });

  it("does not report a foreign key violation for a billed supplier", async () => {
    purchaseModel.count.mockResolvedValue(1);

    const res = await request(app)
      .delete("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.body.code).not.toBe("FOREIGN_KEY_VIOLATION");
  });

  it("deletes a supplier that has never been billed", async () => {
    purchaseModel.count.mockResolvedValue(0);

    const res = await request(app)
      .delete("/api/suppliers/sup_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(204);
    expect(supplierModel.delete).toHaveBeenCalledTimes(1);
  });

  it("404s when the supplier belongs to another organization", async () => {
    supplierModel.delete.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .delete("/api/suppliers/sup_9")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});
