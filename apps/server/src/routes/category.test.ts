import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER } from "../middleware/auth-context";

const { categoryModel, productModel, brandModel } = vi.hoisted(() => ({
  categoryModel: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  productModel: {
    count: vi.fn(),
  },
  brandModel: {
    count: vi.fn(),
  },
}));

vi.mock("@dms/db", () => ({
  default: {
    member: { findFirst: async () => ({ role: "owner" }) },
    category: categoryModel,
    product: productModel,
    brand: brandModel,
  },
  prisma: {
    member: { findFirst: async () => ({ role: "owner" }) },
    category: categoryModel,
    product: productModel,
    brand: brandModel,
  },
}));

const app = createApp();

const ORG = "org_1";

const OTHER_ORG = "org_2";

const categoryFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "cat_1",
  name: "Beverages",
  organizationId: ORG,
  description: "Drinks and mixers",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  _count: { products: 4, brands: 2 },
  ...overrides,
});

const validBody = {
  name: "Beverages",
  description: "Drinks and mixers",
};

const prismaError = (code: string, meta?: Record<string, unknown>) => ({
  code,
  meta,
  name: "PrismaClientKnownRequestError",
});

beforeEach(() => {
  vi.clearAllMocks();
  categoryModel.findMany.mockResolvedValue([categoryFixture()]);
  categoryModel.count.mockResolvedValue(1);
  categoryModel.findFirst.mockResolvedValue(categoryFixture());
  categoryModel.create.mockResolvedValue(categoryFixture());
  categoryModel.update.mockResolvedValue(categoryFixture());
  categoryModel.delete.mockResolvedValue(categoryFixture());
  productModel.count.mockResolvedValue(0);
  brandModel.count.mockResolvedValue(0);
});

describe("organization context", () => {
  it("rejects requests without an organization and never touches the database", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(res.body.details).toBeUndefined();
    expect(categoryModel.findMany).not.toHaveBeenCalled();
  });

  it("serves the health check without an organization", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/categories", () => {
  it("returns the documented paginated envelope", async () => {
    categoryModel.findMany.mockResolvedValue([
      categoryFixture({ id: "cat_1" }),
      categoryFixture({ id: "cat_2" }),
    ]);
    categoryModel.count.mockResolvedValue(45);

    const res = await request(app)
      .get("/api/categories")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(45);
    expect(res.body.pageCount).toBe(3);
  });

  it("scopes the query to the caller's organization and orders by name", async () => {
    await request(app).get("/api/categories").set(ORGANIZATION_HEADER, ORG);

    expect(categoryModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG },
        orderBy: { name: "asc" },
        skip: 0,
        take: 20,
      })
    );
    expect(categoryModel.count).toHaveBeenCalledWith({
      where: { organizationId: ORG },
    });
  });

  it("coerces page and pageSize into skip and take", async () => {
    await request(app)
      .get("/api/categories?page=3&pageSize=10")
      .set(ORGANIZATION_HEADER, ORG);

    expect(categoryModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it("searches the name case-insensitively", async () => {
    await request(app)
      .get("/api/categories?search=bev")
      .set(ORGANIZATION_HEADER, ORG);

    const where = {
      organizationId: ORG,
      name: { contains: "bev", mode: "insensitive" },
    };

    expect(categoryModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where })
    );
    expect(categoryModel.count).toHaveBeenCalledWith({ where });
  });

  it("treats an empty search box as no filter", async () => {
    await request(app)
      .get("/api/categories?search=")
      .set(ORGANIZATION_HEADER, ORG);

    expect(categoryModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });

  it("rejects a non-numeric page instead of coercing it to 1", async () => {
    const res = await request(app)
      .get("/api/categories?page=abc")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(categoryModel.findMany).not.toHaveBeenCalled();
  });

  it("sends product and brand counts instead of the brand rows", async () => {
    await request(app).get("/api/categories").set(ORGANIZATION_HEADER, ORG);

    const { include } = categoryModel.findMany.mock.calls[0][0];

    expect(include).toEqual({
      _count: { select: { products: true, brands: true } },
    });
  });
});

describe("GET /api/categories/:id", () => {
  it("returns the category", async () => {
    const res = await request(app)
      .get("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("cat_1");
  });

  it("looks the category up by id within the caller's organization", async () => {
    await request(app)
      .get("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(categoryModel.findFirst).toHaveBeenCalledWith({
      where: { id: "cat_1", organizationId: ORG },
    });
  });

  it("does not embed the child collections the legacy detail never had", async () => {
    await request(app)
      .get("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG);

    const args = categoryModel.findFirst.mock.calls[0][0];

    expect(args.include).toBeUndefined();
  });

  it("404s when the category belongs to another organization", async () => {
    categoryModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/categories/cat_9")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CATEGORY_NOT_FOUND");
  });
});

describe("POST /api/categories", () => {
  it("creates the category under the caller's organization", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("cat_1");
    expect(categoryModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: "Beverages", description: "Drinks and mixers", organizationId: ORG },
      })
    );
  });

  it("ignores any organization in the body", async () => {
    await request(app)
      .post("/api/categories")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, organizationId: OTHER_ORG });

    const { data } = categoryModel.create.mock.calls[0][0];

    expect(data.organizationId).toBe(ORG);
  });

  it("stores the same name in two organizations", async () => {
    // The unique index is @@unique([name, organizationId]), so this is legal and
    // a globally unique name would be a schema bug. The create has to carry the
    // caller's organization for that to hold.
    await request(app)
      .post("/api/categories")
      .set(ORGANIZATION_HEADER, OTHER_ORG)
      .send(validBody);

    const { data } = categoryModel.create.mock.calls[0][0];

    expect(data).toEqual({
      name: "Beverages",
      description: "Drinks and mixers",
      organizationId: OTHER_ORG,
    });
  });

  it("sends no value for a description the body omitted", async () => {
    await request(app)
      .post("/api/categories")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Snacks" });

    const { data } = categoryModel.create.mock.calls[0][0];

    // Prisma omits a column it was not given, and this column defaults to null.
    expect(data.description).toBeUndefined();
  });

  it("clears a blanked description on create", async () => {
    await request(app)
      .post("/api/categories")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Snacks", description: "" });

    const { data } = categoryModel.create.mock.calls[0][0];

    expect(data.description).toBeNull();
  });

  it("trims the name on create so the unique index compares real names", async () => {
    await request(app)
      .post("/api/categories")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "  Beverages  " });

    const { data } = categoryModel.create.mock.calls[0][0];

    expect(data.name).toBe("Beverages");
  });

  it("rejects a blank name", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.details.fieldErrors)).toContain("name");
    expect(categoryModel.create).not.toHaveBeenCalled();
  });

  it("rejects a request with no body", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(categoryModel.create).not.toHaveBeenCalled();
  });

  it("409s on a duplicate name in the same organization", async () => {
    categoryModel.create.mockRejectedValue(
      prismaError("P2002", { target: ["name", "organizationId"] })
    );

    const res = await request(app)
      .post("/api/categories")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIQUE_CONSTRAINT");
  });
});

describe("PUT /api/categories/:id", () => {
  it("updates the category within the caller's organization", async () => {
    const res = await request(app)
      .put("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Cold Drinks" });

    expect(res.status).toBe(200);
    expect(categoryModel.update).toHaveBeenCalledWith({
      where: { id: "cat_1", organizationId: ORG },
      data: { name: "Cold Drinks" },
    });
  });

  it("answers with the updated category", async () => {
    categoryModel.update.mockResolvedValue(categoryFixture({ name: "Cold Drinks" }));

    const res = await request(app)
      .put("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Cold Drinks" });

    expect(res.body).toMatchObject({ id: "cat_1", name: "Cold Drinks" });
  });

  it("accepts a body with only a description", async () => {
    // The legacy update took the whole form and ran `data.name.trim()`, which
    // threw a TypeError on a body without a name.
    const res = await request(app)
      .put("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ description: "Now only cold drinks" });

    expect(res.status).toBe(200);
    expect(categoryModel.update).toHaveBeenCalledWith({
      where: { id: "cat_1", organizationId: ORG },
      data: { description: "Now only cold drinks" },
    });
  });

  it("clears a description that was blanked out", async () => {
    await request(app)
      .put("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ description: "" });

    const { data } = categoryModel.update.mock.calls[0][0];

    expect(data).toEqual({ description: null });
  });

  it("leaves the description alone when the body omits it", async () => {
    await request(app)
      .put("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Cold Drinks" });

    const { data } = categoryModel.update.mock.calls[0][0];

    expect(data).toEqual({ name: "Cold Drinks" });
  });

  it("cannot re-point the category at another organization", async () => {
    await request(app)
      .put("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Cold Drinks", organizationId: OTHER_ORG, id: "cat_9" });

    const args = categoryModel.update.mock.calls[0][0];

    expect(args.data).toEqual({ name: "Cold Drinks" });
    expect(args.where).toEqual({ id: "cat_1", organizationId: ORG });
  });

  it("rejects a blank name", async () => {
    const res = await request(app)
      .put("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "  " });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(categoryModel.update).not.toHaveBeenCalled();
  });

  it("409s on renaming to a name already used in this organization", async () => {
    categoryModel.update.mockRejectedValue(
      prismaError("P2002", { target: ["name", "organizationId"] })
    );

    const res = await request(app)
      .put("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Snacks" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIQUE_CONSTRAINT");
  });

  it("404s when the category belongs to another organization", async () => {
    categoryModel.update.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .put("/api/categories/cat_9")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Cold Drinks" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /api/categories/:id", () => {
  it("deletes the category and answers 204", async () => {
    const res = await request(app)
      .delete("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("deletes within the caller's organization", async () => {
    await request(app)
      .delete("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(categoryModel.delete).toHaveBeenCalledWith({
      where: { id: "cat_1", organizationId: ORG },
    });
  });

  it("checks products and brands within the caller's organization", async () => {
    await request(app)
      .delete("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(productModel.count).toHaveBeenCalledWith({
      where: { categoryId: "cat_1", organizationId: ORG },
    });
    expect(brandModel.count).toHaveBeenCalledWith({
      where: { categoryId: "cat_1", organizationId: ORG },
    });
  });

  it("refuses to delete a category that still has products", async () => {
    productModel.count.mockResolvedValue(6);

    const res = await request(app)
      .delete("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CATEGORY_IN_USE");
    expect(res.body.details).toEqual({ productCount: 6, brandCount: 0 });
    expect(categoryModel.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete a category that still has brands", async () => {
    brandModel.count.mockResolvedValue(3);

    const res = await request(app)
      .delete("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CATEGORY_IN_USE");
    expect(res.body.details).toEqual({ productCount: 0, brandCount: 3 });
    expect(categoryModel.delete).not.toHaveBeenCalled();
  });

  it("does not report a foreign key violation for a category in use", async () => {
    productModel.count.mockResolvedValue(1);

    const res = await request(app)
      .delete("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.body.code).not.toBe("FOREIGN_KEY_VIOLATION");
  });

  it("deletes a category nothing is attached to", async () => {
    const res = await request(app)
      .delete("/api/categories/cat_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(204);
    expect(categoryModel.delete).toHaveBeenCalledTimes(1);
  });

  it("404s when the category belongs to another organization", async () => {
    categoryModel.delete.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .delete("/api/categories/cat_9")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});
