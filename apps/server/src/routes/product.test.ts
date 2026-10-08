import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER } from "../middleware/auth-context";

const { productModel, categoryModel, brandModel } = vi.hoisted(() => ({
  productModel: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  // The service proves a product's `category` and `brand` belong to the caller's
  // own tenant before writing the foreign keys. `findFirst` scoped by
  // organizationId is the whole check, so a hit means "mine" and a miss means
  // "not mine" -- the same query shape that lets the service refuse a cross-tenant
  // reference.
  categoryModel: { findFirst: vi.fn() },
  brandModel: { findFirst: vi.fn() },
}));

vi.mock("@dms/db", () => ({
  default: {
    member: { findFirst: async () => ({ role: "owner" }) },
    product: productModel,
    category: categoryModel,
    brand: brandModel,
  },
  prisma: {
    member: { findFirst: async () => ({ role: "owner" }) },
    product: productModel,
    category: categoryModel,
    brand: brandModel,
  },
}));

const app = createApp();

const ORG = "org_1";

const OTHER_ORG = "org_2";

const productFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "prod_1",
  productCode: "TEST-001",
  organizationId: ORG,
  name: "Test Product",
  description: "",
  categoryId: "cat_1",
  brandId: "brand_1",
  unit: "pcs",
  unitCost: 10,
  unitPrice: 20,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  category: { id: "cat_1", name: "Beverages" },
  brand: { id: "brand_1", name: "Acme" },
  inventory: { id: "inv_1", quantityOnHand: 5, quantityReserved: 0 },
  ...overrides,
});

const validBody = {
  name: "Test Product",
  productCode: "TEST-001",
  category: "cat_1",
  unit: "pcs",
  brand: "brand_1",
  description: "A test product",
  unitCost: "10.00",
  unitPrice: "20.00",
  isActive: true,
};

const prismaError = (code: string, meta?: Record<string, unknown>) => ({
  code,
  meta,
  name: "PrismaClientKnownRequestError",
});

beforeEach(() => {
  vi.clearAllMocks();
  productModel.findMany.mockResolvedValue([productFixture()]);
  productModel.count.mockResolvedValue(1);
  productModel.findFirst.mockResolvedValue(productFixture());
  productModel.create.mockResolvedValue(productFixture());
  productModel.update.mockResolvedValue(productFixture());
  productModel.delete.mockResolvedValue(productFixture());
  // Default: the tenant owns both referenced rows, so the reference check passes.
  // A test that wants a foreign reference overrides one of these with `null`.
  categoryModel.findFirst.mockResolvedValue({ id: "cat_1" });
  brandModel.findFirst.mockResolvedValue({ id: "brand_1" });
});

describe("organization context", () => {
  it("rejects requests without an organization and never touches the database", async () => {
    const res = await request(app).get("/api/products");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(res.body.details).toBeUndefined();
    expect(productModel.findMany).not.toHaveBeenCalled();
  });

  it("serves the health check without an organization", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/products", () => {
  it("returns the documented paginated envelope", async () => {
    productModel.findMany.mockResolvedValue([
      productFixture({ id: "prod_1" }),
      productFixture({ id: "prod_2" }),
    ]);
    productModel.count.mockResolvedValue(45);

    const res = await request(app)
      .get("/api/products")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(45);
    expect(res.body.pageCount).toBe(3);
  });

  it("scopes the query to the caller's organization and orders by name", async () => {
    await request(app).get("/api/products").set(ORGANIZATION_HEADER, ORG);

    expect(productModel.findMany).toHaveBeenCalledTimes(1);
    expect(productModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG },
        orderBy: { name: "asc" },
        skip: 0,
        take: 20,
      })
    );
    expect(productModel.count).toHaveBeenCalledWith({
      where: { organizationId: ORG },
    });
  });

  it("coerces page and pageSize into skip and take", async () => {
    await request(app)
      .get("/api/products?page=3&pageSize=10")
      .set(ORGANIZATION_HEADER, ORG);

    expect(productModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it("rejects an out of range pageSize", async () => {
    const res = await request(app)
      .get("/api/products?pageSize=1000")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(productModel.findMany).not.toHaveBeenCalled();
  });

  it("filters on search and isActive", async () => {
    await request(app)
      .get("/api/products?search=cola&isActive=false")
      .set(ORGANIZATION_HEADER, ORG);

    expect(productModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          isActive: false,
          OR: [
            { name: { contains: "cola", mode: "insensitive" } },
            { productCode: { contains: "cola", mode: "insensitive" } },
          ],
        },
      })
    );
  });

  it("treats isActive=false as false rather than coercing it to true", async () => {
    await request(app)
      .get("/api/products?isActive=true")
      .set(ORGANIZATION_HEADER, ORG);

    expect(productModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG, isActive: true } })
    );
  });

  it("ignores an empty search instead of rejecting it", async () => {
    const res = await request(app)
      .get("/api/products?search=")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(productModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });

  it("rejects a non boolean isActive", async () => {
    const res = await request(app)
      .get("/api/products?isActive=maybe")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/products/:id", () => {
  it("returns the product with its relations", async () => {
    const res = await request(app)
      .get("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("prod_1");
    expect(res.body.category).toEqual({ id: "cat_1", name: "Beverages" });
    expect(res.body.inventory).toMatchObject({ quantityOnHand: 5 });
  });

  it("scopes the lookup to the caller's organization", async () => {
    await request(app)
      .get("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(productModel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod_1", organizationId: ORG },
      })
    );
  });

  it("returns 404 for a product in another organization", async () => {
    productModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Product not found", code: "PRODUCT_NOT_FOUND" });
  });
});

describe("POST /api/products", () => {
  it("accepts string money, coerces it, and maps category/brand to relation ids", async () => {
    const res = await request(app)
      .post("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(productModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: "Test Product",
          productCode: "TEST-001",
          unit: "pcs",
          description: "A test product",
          unitCost: 10,
          unitPrice: 20,
          isActive: true,
          categoryId: "cat_1",
          brandId: "brand_1",
          organizationId: ORG,
        },
      })
    );
  });

  it("accepts numeric money and defaults isActive to true", async () => {
    const { isActive: _isActive, ...withoutIsActive } = validBody;

    const res = await request(app)
      .post("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ ...withoutIsActive, unitCost: 10, unitPrice: 20.5 });

    expect(res.status).toBe(201);
    expect(productModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitCost: 10,
          unitPrice: 20.5,
          isActive: true,
        }),
      })
    );
  });

  it("stores an omitted description as an empty string", async () => {
    const { description: _description, ...withoutDescription } = validBody;

    await request(app)
      .post("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .send(withoutDescription);

    expect(productModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: "" }),
      })
    );
  });

  it("rejects an invalid payload with field level errors", async () => {
    const res = await request(app)
      .post("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details.fieldErrors.name).toEqual([
      "Product name must be at least 2 characters",
    ]);
    expect(productModel.create).not.toHaveBeenCalled();
  });

  it("rejects money that is not a valid non-negative number", async () => {
    for (const unitCost of ["abc", "-1", ""]) {
      const res = await request(app)
        .post("/api/products")
        .set(ORGANIZATION_HEADER, ORG)
        .send({ ...validBody, unitCost });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    }

    expect(productModel.create).not.toHaveBeenCalled();
  });

  it("maps a duplicate product code to 409", async () => {
    productModel.create.mockRejectedValue(
      prismaError("P2002", { target: ["productCode"] })
    );

    const res = await request(app)
      .post("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIQUE_CONSTRAINT");
    expect(res.body.details).toEqual({ target: ["productCode"] });
  });

  it("refuses a category or brand from another tenant", async () => {
    // The check runs before the write, so `create` is never reached. Previously
    // the foreign key was written straight from the body and the database caught
    // it as a bare P2003 -- which also meant a product could not be pointed at
    // another tenant's category at all without a 400 that named neither cause.
    categoryModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("CATEGORY_NOT_IN_ORGANIZATION");
    expect(productModel.create).not.toHaveBeenCalled();
  });

  it("refuses a brand from another tenant", async () => {
    brandModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("BRAND_NOT_IN_ORGANIZATION");
    expect(productModel.create).not.toHaveBeenCalled();
  });

  it("scopes the reference check to the caller's own tenant", async () => {
    await request(app)
      .post("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    // A bare `findUnique({ where: { id } })` would pass for any tenant's row.
    // The tenant is part of the predicate, so the answer is "mine" or not.
    expect(categoryModel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "cat_1", organizationId: ORG } })
    );
    expect(brandModel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "brand_1", organizationId: ORG } })
    );
  });

  it("still maps a genuine foreign key violation to 400", async () => {
    // The reference check covers category and brand. Any other foreign key the
    // database rejects keeps the central P2003 mapping.
    productModel.create.mockRejectedValue(prismaError("P2003"));

    const res = await request(app)
      .post("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("FOREIGN_KEY_VIOLATION");
  });
});

describe("PUT /api/products/:id", () => {
  it("applies only the fields present in the body", async () => {
    const res = await request(app)
      .put("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "  Renamed  " });

    expect(res.status).toBe(200);
    expect(productModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod_1", organizationId: ORG },
        data: { name: "Renamed" },
      })
    );
  });

  it("does not re-activate a product when isActive is omitted", async () => {
    await request(app)
      .put("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Renamed" });

    const { data } = productModel.update.mock.calls[0][0];
    expect(data).not.toHaveProperty("isActive");
  });

  it("maps category and brand to relation ids", async () => {
    await request(app)
      .put("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ category: "cat_2", brand: "brand_2" });

    expect(productModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { categoryId: "cat_2", brandId: "brand_2" },
      })
    );
  });

  it("coerces money supplied as strings", async () => {
    await request(app)
      .put("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ unitPrice: "25.75" });

    expect(productModel.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { unitPrice: 25.75 } })
    );
  });

  it("rejects invalid input before reaching the database", async () => {
    const res = await request(app)
      .put("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ unitCost: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(productModel.update).not.toHaveBeenCalled();
  });

  it("maps a missing record to 404", async () => {
    productModel.update.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .put("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Renamed" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /api/products/:id", () => {
  it("returns 204 and scopes the delete to the caller's organization", async () => {
    const res = await request(app)
      .delete("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(productModel.delete).toHaveBeenCalledWith({
      where: { id: "prod_1", organizationId: ORG },
    });
  });

  it("maps a missing record to 404 instead of deleting blindly", async () => {
    productModel.delete.mockRejectedValue(prismaError("P2025"));

    const res = await request(app)
      .delete("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, OTHER_ORG);

    expect(res.status).toBe(404);
  });
});

describe("transport level errors", () => {
  it("returns 404 for an unknown route", async () => {
    const res = await request(app)
      .get("/api/nope")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ROUTE_NOT_FOUND");
  });

  it("returns 400 for a malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .set("Content-Type", "application/json")
      .send('{"name":');

    expect(res.status).toBe(400);
    expect(productModel.create).not.toHaveBeenCalled();
  });

  it("returns 500 without leaking internals when a handler throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    productModel.findMany.mockRejectedValue(new Error("connection terminated"));

    const res = await request(app)
      .get("/api/products")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error", code: "INTERNAL_ERROR" });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
