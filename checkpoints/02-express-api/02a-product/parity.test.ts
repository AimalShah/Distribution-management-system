/**
 * Checkpoint 2a — Product API: Parity Test
 *
 * Scope: what a real PostgreSQL is the only thing that can answer. The request
 * shapes, status codes and validation rules are already pinned by
 * `apps/server/src/routes/product.test.ts` (mocked Prisma), so duplicating them
 * here would add a slower copy of the same assertions. What that suite cannot
 * observe is:
 *
 *   - the constraints `schema.prisma` declares but no service checks
 *     (`productCode @unique`, `Brand.categoryId` foreign key, the
 *     `Product -> Category` / `Product -> Brand` relations);
 *   - tenant scoping across a *relation*: a product names a category and a brand,
 *     and both have to belong to the caller's tenant, which the service checks
 *     with two `findFirst` calls before writing;
 *   - whether the seeded rows are actually reachable through the API.
 *
 * `source-review.md` for this checkpoint flags two behaviors to preserve:
 * money arrives as a string from forms and a number from JSON, so both must be
 * accepted; and the Express version intentionally adds pagination.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  app,
  asOrg,
  errorBody,
  expect as _expect,
  hasDatabase,
  prisma,
  request,
  seedTenants,
  skipReason,
  teardownTenants,
  unique,
  type Tenant,
} from "../../support/parity-db";

describe.skipIf(!hasDatabase)("Checkpoint 2a — Product API", () => {
  let t: Tenant;

  beforeAll(async () => {
    t = await seedTenants();
  });

  afterAll(async () => {
    if (t) await teardownTenants(t);
  });

  const validBody = () => ({
    name: "Parity Product",
    productCode: unique("SKU"),
    category: t.categoryId,
    brand: t.brandId,
    unit: "pcs",
    description: "created by the 02a parity suite",
    unitCost: "10.00",
    unitPrice: "20.00",
  });

  it("returns only the caller's products, with the documented relations", async () => {
    const res = await request(app).get("/api/products").set(asOrg(t.organizationId));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // The seed created exactly one product for this org, and one for the other.
    expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([t.productId]);
    expect(res.body.total).toBe(1);
    expect(res.body.pageCount).toBe(1);
  });

  it("does not leak the other tenant's products", async () => {
    const res = await request(app).get("/api/products").set(asOrg(t.organizationId));
    const ids = (res.body.data as { id: string }[]).map((p) => p.id);

    expect(ids).not.toContain(t.otherProductId);
  });

  it("paginates, and page/pageSize agree with total and pageCount", async () => {
    // Three more products so pageSize=2 needs two pages.
    for (let i = 0; i < 3; i += 1) {
      await prisma.product.create({
        data: {
          productCode: unique("SKU"),
          organizationId: t.organizationId,
          name: `Paged ${i}`,
          categoryId: t.categoryId,
          brandId: t.brandId,
          unit: "pcs",
          unitCost: 1,
          unitPrice: 2,
        },
      });
    }

    const page1 = await request(app)
      .get("/api/products?page=1&pageSize=2")
      .set(asOrg(t.organizationId));
    const page2 = await request(app)
      .get("/api/products?page=2&pageSize=2")
      .set(asOrg(t.organizationId));

    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.total).toBe(4); // the seeded product plus three
    expect(page1.body.pageCount).toBe(2);
    expect(page2.body.data).toHaveLength(2);

    // No row appears on both pages.
    const ids = [
      ...(page1.body.data as { id: string }[]).map((p) => p.id),
      ...(page2.body.data as { id: string }[]).map((p) => p.id),
    ];
    expect(new Set(ids).size).toBe(4);
  });

  it("accepts money as a string and as a number", async () => {
    // `source-review.md`: "the Express API should accept both".
    const asString = await request(app)
      .post("/api/products")
      .set(asOrg(t.organizationId))
      .send({ ...validBody(), unitCost: "12.34", unitPrice: "56.78" });
    const asNumber = await request(app)
      .post("/api/products")
      .set(asOrg(t.organizationId))
      .send({ ...validBody(), unitCost: 12.34, unitPrice: 56.78 });

    expect(asString.status).toBe(201);
    expect(asNumber.status).toBe(201);
    // Both land as numbers in the database, not as the strings they arrived as.
    expect(asString.body.unitCost).toBe(12.34);
    expect(asNumber.body.unitCost).toBe(12.34);
  });

  it("rejects a duplicate productCode with 409 UNIQUE_CONSTRAINT", async () => {
    const code = unique("SKU");
    const first = await request(app)
      .post("/api/products")
      .set(asOrg(t.organizationId))
      .send({ ...validBody(), productCode: code });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/products")
      .set(asOrg(t.organizationId))
      .send({ ...validBody(), productCode: code });

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject(errorBody.unique);
  });

  it("refuses a brand from another tenant with 422", async () => {
    // The service proves the brand belongs to the caller's org before writing the
    // foreign key. This is the assertion a mocked `brandModel.findFirst` makes
    // structurally impossible to trust: with a mock, "it called findFirst" and
    // "it refused the write" are the same event.
    //
    // 422 rather than 400, deliberately: the body is well-formed and the id is a
    // real row, so there is nothing to correct -- the reference is simply to
    // something this tenant may not use. `http/errors.ts` says as much, and 400
    // here would read as "malformed request" and invite a client-side retry loop.
    const res = await request(app)
      .post("/api/products")
      .set(asOrg(t.organizationId))
      .send({ ...validBody(), brand: t.otherBrandId });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject(errorBody.brandNotInOrganization);
    expect(res.body.error).toMatch(/brand that belongs to this organization/i);
  });

  it("refuses a category from another tenant with 422", async () => {
    const res = await request(app)
      .post("/api/products")
      .set(asOrg(t.organizationId))
      .send({ ...validBody(), category: t.otherCategoryId });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject(errorBody.categoryNotInOrganization);
    expect(res.body.error).toMatch(/category that belongs to this organization/i);
  });

  it("answers 422 for a category id that belongs to no tenant", async () => {
    // An id that is well-formed but belongs to nobody is indistinguishable from a
    // foreign one as far as `assertRefsInOrganization` is concerned -- `findFirst`
    // simply misses. So this is 422 as well, and the `P2003` path
    // (`translatePrismaError` -> 400 FOREIGN_KEY_VIOLATION) is *not* what a
    // caller sees when the id is missing. It is still reachable, but only when the
    // pre-check passes and the row is deleted between the check and the write, so
    // it is not something a test can reach through the API on purpose.
    //
    // Asserting the real behaviour here rather than the reachable-sounding one:
    // the tempting version of this test is "expect 400 FOREIGN_KEY_VIOLATION",
    // which documents a code path a caller can never observe.
    const res = await request(app)
      .post("/api/products")
      .set(asOrg(t.organizationId))
      .send({ ...validBody(), category: "cat_does_not_exist" });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject(errorBody.categoryNotInOrganization);
  });

  it("returns 404 for another tenant's product id", async () => {
    const res = await request(app)
      .get(`/api/products/${t.otherProductId}`)
      .set(asOrg(t.organizationId));

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject(errorBody.notFound);
  });

  it("updates only the caller's own product", async () => {
    const res = await request(app)
      .put(`/api/products/${t.productId}`)
      .set(asOrg(t.organizationId))
      .send({ name: "Renamed" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed");
  });

  it("PUT does not reactivate an archived product when isActive is omitted", async () => {
    // `ProductUpdateSchema` overrides `isActive`'s `.default(true)`. With the
    // plain `.partial()` this would silently un-archive the product.
    await prisma.product.update({ where: { id: t.productId }, data: { isActive: false } });

    const res = await request(app)
      .put(`/api/products/${t.productId}`)
      .set(asOrg(t.organizationId))
      .send({ name: "Still archived" });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);

    const row = await prisma.product.findUniqueOrThrow({ where: { id: t.productId } });
    expect(row.isActive).toBe(false);
  });

  it("deletes the product and its inventory cascade", async () => {
    await prisma.inventory.create({
      data: { productId: t.productId, organizationId: t.organizationId, quantityOnHand: 7 },
    });

    const res = await request(app)
      .delete(`/api/products/${t.productId}`)
      .set(asOrg(t.organizationId));
    expect(res.status).toBe(204);

    expect(await prisma.product.findUnique({ where: { id: t.productId } })).toBeNull();
    // `Inventory.product` is `onDelete: Cascade`, so the row goes with it.
    expect(
      await prisma.inventory.findMany({ where: { productId: t.productId } })
    ).toEqual([]);
  });

  it("requires an organization header", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.organizationRequired);
  });
});

// Reported once, outside the skipped describe, so a missing database is visible
// in the output rather than silently absent.
if (!hasDatabase) {
  describe("Checkpoint 2a — database", () => {
    it(`skipped: ${skipReason}`, () => {
      expect(hasDatabase).toBe(false);
    });
  });
}
