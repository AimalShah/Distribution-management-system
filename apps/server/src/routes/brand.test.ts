import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER } from "../middleware/auth-context";

const { brandModel, categoryModel, productModel } = vi.hoisted(() => ({
  brandModel: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  categoryModel: {
    findFirst: vi.fn(),
  },
  productModel: {
    count: vi.fn(),
  },
}));

vi.mock("@dms/db", () => ({
  default: {
    brand: brandModel,
    category: categoryModel,
    product: productModel,
  },
  prisma: {
    brand: brandModel,
    category: categoryModel,
    product: productModel,
  },
}));

const app = createApp();

const ORG = "org_1";
const OTHER_ORG = "org_2";

const brandFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "brand_1",
  name: "Coca-Cola",
  organizationId: ORG,
  categoryId: "cat_1",
  description: "Soft drinks",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const validBody = {
  name: "Coca-Cola",
  categoryId: "cat_1",
  description: "Soft drinks",
};

const prismaError = (code: string, meta?: Record<string, unknown>) => ({
  code,
  meta,
  name: "PrismaClientKnownRequestError",
});

beforeEach(() => {
  vi.clearAllMocks();
  brandModel.findMany.mockResolvedValue([brandFixture()]);
  brandModel.count.mockResolvedValue(1);
  brandModel.findFirst.mockResolvedValue(brandFixture());
  brandModel.create.mockResolvedValue(brandFixture());
  brandModel.update.mockResolvedValue(brandFixture());
  brandModel.delete.mockResolvedValue(brandFixture());
  categoryModel.findFirst.mockResolvedValue({ id: "cat_1" });
  productModel.count.mockResolvedValue(0);
});

describe("organization context", () => {
  it("rejects requests without an organization and never touches the database", async () => {
    const res = await request(app).get("/api/brands");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(brandModel.findMany).not.toHaveBeenCalled();
  });

  it("serves the health check without an organization", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/brands", () => {
  it("returns the documented paginated envelope", async () => {
    brandModel.findMany.mockResolvedValue([
      brandFixture({ id: "brand_1" }),
      brandFixture({ id: "brand_2" }),
    ]);
    brandModel.count.mockResolvedValue(45);

    const res = await request(app)
      .get("/api/brands")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(45);
    expect(res.body.pageCount).toBe(3);
  });

  it("scopes the query to the caller's organization and orders by name", async () => {
    await request(app).get("/api/brands").set(ORGANIZATION_HEADER, ORG);

    expect(brandModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG },
        orderBy: { name: "asc" },
        skip: 0,
        take: 20,
      })
    );
    expect(brandModel.count).toHaveBeenCalledWith({
      where: { organizationId: ORG },
    });
  });

  it("coerces page and pageSize into skip and take", async () => {
    await request(app)
      .get("/api/brands?page=3&pageSize=10")
      .set(ORGANIZATION_HEADER, ORG);

    expect(brandModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it("searches the name case-insensitively", async () => {
    await request(app)
      .get("/api/brands?search=coca")
      .set(ORGANIZATION_HEADER, ORG);

    const where = {
      organizationId: ORG,
      name: { contains: "coca", mode: "insensitive" },
    };

    expect(brandModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where })
    );
    expect(brandModel.count).toHaveBeenCalledWith({ where });
  });

  it("treats an empty search box as no filter", async () => {
    await request(app)
      .get("/api/brands?search=")
      .set(ORGANIZATION_HEADER, ORG);

    expect(brandModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });

  it("filters to one category when categoryId is given", async () => {
    await request(app)
      .get("/api/brands?categoryId=cat_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(brandModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, categoryId: "cat_1" },
      })
    );
  });

  it("rejects an empty categoryId rather than widening to every category", async () => {
    // A category dropdown that submits "" means "no category". Treating that as
    // "all categories" would quietly return rows the user did not ask for.
    const res = await request(app)
      .get("/api/brands?categoryId=")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(brandModel.findMany).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric page instead of coercing it to 1", async () => {
    const res = await request(app)
      .get("/api/brands?page=abc")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(brandModel.findMany).not.toHaveBeenCalled();
  });

  it("sends a product count instead of the product rows", async () => {
    await request(app).get("/api/brands").set(ORGANIZATION_HEADER, ORG);

    const { include } = brandModel.findMany.mock.calls[0][0];

    expect(include).toEqual({ _count: { select: { products: true } } });
  });
});

describe("GET /api/brands/:id", () => {
  it("returns the brand", async () => {
    const res = await request(app)
      .get("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("brand_1");
  });

  it("looks the brand up by id within the caller's organization", async () => {
    // The legacy getBrandById used findUnique({ where: { id } }) with no tenant
    // filter, so any authenticated member could read another tenant's brand.
    await request(app)
      .get("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(brandModel.findFirst).toHaveBeenCalledWith({
      where: { id: "brand_1", organizationId: ORG },
    });
  });

  it("does not embed the collections the legacy detail never had", async () => {
    await request(app)
      .get("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(brandModel.findFirst.mock.calls[0][0].include).toBeUndefined();
  });

  it("404s when the brand belongs to another organization", async () => {
    brandModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/brands/brand_9")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("BRAND_NOT_FOUND");
  });
});

describe("POST /api/brands", () => {
  it("creates the brand under the caller's organization", async () => {
    const res = await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("brand_1");
    expect(brandModel.create).toHaveBeenCalledWith({
      data: { name: "Coca-Cola", categoryId: "cat_1", description: "Soft drinks", organizationId: ORG },
    });
  });

  it("ignores any organization in the body", async () => {
    await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, organizationId: OTHER_ORG });

    // The legacy schema demanded an organizationId that addBrand then overwrote
    // with the session value, so the field was collected and then discarded.
    expect(brandModel.create.mock.calls[0][0].data.organizationId).toBe(ORG);
  });

  it("carries the caller's organizationId, so one name can exist in two tenants", async () => {
    // @@unique([name, categoryId, organizationId]) is a composite index, so the
    // same name is legal in two tenants and a globally unique name would be a
    // schema bug. The create has to carry the caller's organization for that.
    await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, OTHER_ORG)
      .send(validBody);

    expect(brandModel.create.mock.calls[0][0].data).toEqual({
      name: "Coca-Cola",
      categoryId: "cat_1",
      description: "Soft drinks",
      organizationId: OTHER_ORG,
    });
  });

  it("trims the name on create so the unique index compares real names", async () => {
    await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, name: "  Coca-Cola  " });

    expect(brandModel.create.mock.calls[0][0].data.name).toBe("Coca-Cola");
  });

  it("sends no value for a description the body omitted", async () => {
    await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Pepsi", categoryId: "cat_1" });

    // Prisma omits a column it was not given, and this column defaults to null.
    expect(brandModel.create.mock.calls[0][0].data.description).toBeUndefined();
  });

  it("clears a blanked description on create", async () => {
    await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, description: "" });

    expect(brandModel.create.mock.calls[0][0].data.description).toBeNull();
  });

  it("rejects a blank name", async () => {
    const res = await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...validBody, name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.details.fieldErrors)).toContain("name");
    expect(brandModel.create).not.toHaveBeenCalled();
  });

  it("rejects a body with no categoryId, which the legacy schema never required", async () => {
    // Brand.categoryId is a non-nullable foreign key, so a create without one
    // fails at the database. The shared schema used to make it optional, which
    // moved a 500 out of the form and into the request.
    const res = await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Coca-Cola" });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details.fieldErrors)).toContain("categoryId");
    expect(brandModel.create).not.toHaveBeenCalled();
  });

  it("rejects a blank categoryId", async () => {
    const res = await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Coca-Cola", categoryId: "" });

    expect(res.status).toBe(400);
    expect(brandModel.create).not.toHaveBeenCalled();
  });

  it("rejects a request with no body", async () => {
    const res = await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(brandModel.create).not.toHaveBeenCalled();
  });

  it("422s when the category belongs to another organization", async () => {
    // categoryId is a plain foreign key with no tenant constraint, so the
    // database would happily store a brand filed under another tenant's
    // category. That also corrupts the 2h category delete guard, which counts
    // brands by category within the owning organization.
    categoryModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("CATEGORY_NOT_IN_ORGANIZATION");
    expect(brandModel.create).not.toHaveBeenCalled();
  });

  it("checks the category within the caller's organization", async () => {
    await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(categoryModel.findFirst).toHaveBeenCalledWith({
      where: { id: "cat_1", organizationId: ORG },
      select: { id: true },
    });
  });

  it("does not confirm whether a foreign category id exists", async () => {
    categoryModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    // Answering "that category is not yours" would confirm the id is real.
    expect(res.body.error).not.toMatch(/exist|found|another organization/i);
  });

  it("409s on a duplicate name in the same category and organization", async () => {
    brandModel.create.mockRejectedValue(
      prismaError("P2002", { target: ["name", "categoryId", "organizationId"] })
    );

    const res = await request(app)
      .post("/api/brands")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIQUE_CONSTRAINT");
  });
});

describe("PUT /api/brands/:id", () => {
  it("updates the brand within the caller's organization", async () => {
    const res = await request(app)
      .put("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Coca-Cola Classic" });

    expect(res.status).toBe(200);
    expect(brandModel.update).toHaveBeenCalledWith({
      where: { id: "brand_1", organizationId: ORG },
      data: { name: "Coca-Cola Classic" },
    });
  });

  it("answers with the updated brand", async () => {
    brandModel.update.mockResolvedValue(brandFixture({ name: "Coca-Cola Classic" }));

    const res = await request(app)
      .put("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Coca-Cola Classic" });

    expect(res.body).toMatchObject({ id: "brand_1", name: "Coca-Cola Classic" });
  });

  it("re-files the brand into another category in the same organization", async () => {
    const res = await request(app)
      .put("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ categoryId: "cat_2" });

    expect(res.status).toBe(200);
    expect(categoryModel.findFirst).toHaveBeenCalledWith({
      where: { id: "cat_2", organizationId: ORG },
      select: { id: true },
    });
    expect(brandModel.update).toHaveBeenCalledWith({
      where: { id: "brand_1", organizationId: ORG },
      data: { categoryId: "cat_2" },
    });
  });

  it("422s when a re-file points at another organization's category", async () => {
    categoryModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .put("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ categoryId: "cat_foreign" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("CATEGORY_NOT_IN_ORGANIZATION");
    expect(brandModel.update).not.toHaveBeenCalled();
  });

  it("does not check the category when the body does not name one", async () => {
    await request(app)
      .put("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Coca-Cola Classic" });

    expect(categoryModel.findFirst).not.toHaveBeenCalled();
  });

  it("accepts a body with only a description", async () => {
    // The legacy update took the whole form and ran data.name.trim(), which threw
    // a TypeError on a body without a name and was reported as "Failed to fetch
    // brand".
    const res = await request(app)
      .put("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ description: "Now only the classic line" });

    expect(res.status).toBe(200);
    expect(brandModel.update).toHaveBeenCalledWith({
      where: { id: "brand_1", organizationId: ORG },
      data: { description: "Now only the classic line" },
    });
  });

  it("clears a description that was blanked out", async () => {
    await request(app)
      .put("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ description: "" });

    // Legacy: ...(data.description && { description: ... }). An empty string is
    // falsy, so the key was dropped and the old text stayed with a success
    // message.
    expect(brandModel.update.mock.calls[0][0].data).toEqual({ description: null });
  });

  it("leaves the description alone when the body omits it", async () => {
    await request(app)
      .put("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Coca-Cola Classic" });

    expect(brandModel.update.mock.calls[0][0].data).toEqual({
      name: "Coca-Cola Classic",
    });
  });

  it("accepts an empty body as a no-op", async () => {
    const res = await request(app)
      .put("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({});

    expect(res.status).toBe(200);
    expect(brandModel.update.mock.calls[0][0].data).toEqual({});
  });

  it("cannot re-point the brand at another organization", async () => {
    await request(app)
      .put("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Coca-Cola Classic", organizationId: OTHER_ORG, id: "brand_9" });

    const args = brandModel.update.mock.calls[0][0];

    expect(args.data).toEqual({ name: "Coca-Cola Classic" });
    expect(args.where).toEqual({ id: "brand_1", organizationId: ORG });
  });

  it("rejects a blank name", async () => {
    const res = await request(app)
      .put("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "  " });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(brandModel.update).not.toHaveBeenCalled();
  });

  it("409s on renaming to a name already used in this category", async () => {
    brandModel.update.mockRejectedValue(
      prismaError("P2002", { target: ["name", "categoryId", "organizationId"] })
    );

    const res = await request(app)
      .put("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Pepsi" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIQUE_CONSTRAINT");
  });

  it("404s when the brand belongs to another organization", async () => {
    brandModel.update.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .put("/api/brands/brand_9")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Coca-Cola Classic" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /api/brands/:id", () => {
  it("deletes the brand and answers 204", async () => {
    const res = await request(app)
      .delete("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("deletes within the caller's organization", async () => {
    // The legacy deleteBrand used delete({ where: { id } }) with no tenant
    // filter, so it would have removed another tenant's brand.
    await request(app)
      .delete("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(brandModel.delete).toHaveBeenCalledWith({
      where: { id: "brand_1", organizationId: ORG },
    });
  });

  it("counts the products attached to the brand", async () => {
    await request(app)
      .delete("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(productModel.count).toHaveBeenCalledWith({
      where: { brandId: "brand_1", organizationId: ORG },
    });
  });

  it("refuses to delete a brand that still has products", async () => {
    // Product.brandId is a non-nullable foreign key, so the delete would fail
    // P2003, which renders as a message describing neither cause.
    productModel.count.mockResolvedValue(6);

    const res = await request(app)
      .delete("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("BRAND_IN_USE");
    expect(res.body.details).toEqual({ productCount: 6 });
    expect(brandModel.delete).not.toHaveBeenCalled();
  });

  it("does not report a foreign key violation for a brand in use", async () => {
    productModel.count.mockResolvedValue(1);

    const res = await request(app)
      .delete("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.body.code).not.toBe("FOREIGN_KEY_VIOLATION");
  });

  it("deletes a brand nothing is attached to", async () => {
    const res = await request(app)
      .delete("/api/brands/brand_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(204);
    expect(brandModel.delete).toHaveBeenCalledTimes(1);
  });

  it("404s when the brand belongs to another organization", async () => {
    brandModel.delete.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .delete("/api/brands/brand_9")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});
