/**
 * Checkpoint 2i — Brand API: Parity Test
 *
 * Scope: a brand reaches its tenant through a relation, which is the case a
 * mocked `findFirst` makes structurally impossible to trust.
 *
 * `Brand` has both an `organizationId` and a `categoryId`, and the second is what
 * the service actually checks. `brand.ts` spells out why: "`Brand.categoryId` is a
 * plain foreign key with no tenant constraint of its own -- the database checks
 * that some category with that id exists, and nothing checks that it is in the
 * same organization as the brand." So a brand filed under another tenant's
 * category is perfectly storable, and only a real second tenant's category makes
 * the difference visible.
 *
 * The composite unique is the other half. `@@unique([name, categoryId,
 * organizationId])` means the same name is legal in two categories of one tenant
 * and illegal twice in the same one -- neither a global index nor a
 * per-tenant-only index would get that right, and both wrong answers are invisible
 * to a mock.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  app,
  asOrg,
  errorBody,
  hasDatabase,
  prisma,
  request,
  seedTenants,
  skipReason,
  teardownTenants,
  unique,
  type Tenant,
} from "../../support/parity-db";

describe.skipIf(!hasDatabase)("Checkpoint 2i — Brand API", () => {
  let t: Tenant;

  beforeAll(async () => {
    t = await seedTenants();
  });

  afterAll(async () => {
    if (t) await teardownTenants(t);
  });

  const form = (over: Record<string, unknown> = {}) => ({
    name: unique("Brand"),
    categoryId: t.categoryId,
    ...over,
  });

  it("creates a brand under one of the caller's own categories", async () => {
    const res = await request(app)
      .post("/api/brands")
      .set(asOrg(t.organizationId))
      .send(form({ name: "Coca-Cola" }));

    expect(res.status).toBe(201);
    expect(res.body.categoryId).toBe(t.categoryId);

    const row = await prisma.brand.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.organizationId).toBe(t.organizationId);
  });

  it("refuses a category belonging to another tenant", async () => {
    // 422 rather than 400: the body is well-formed and the id names a real row,
    // so there is nothing for the caller to correct -- the reference is simply to
    // something this tenant may not use. Without this check a member of tenant A
    // would see a brand whose category is not in their own list, and tenant B's
    // category delete guard would count that brand against tenant B.
    const res = await request(app)
      .post("/api/brands")
      .set(asOrg(t.organizationId))
      .send(form({ categoryId: t.otherCategoryId }));

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: "CATEGORY_NOT_IN_ORGANIZATION" });
    expect(await prisma.brand.count({ where: { categoryId: t.otherCategoryId } })).toBe(1);
  });

  it("rejects a re-file onto another tenant's category on update too", async () => {
    const created = await request(app)
      .post("/api/brands")
      .set(asOrg(t.organizationId))
      .send(form());

    const id = created.body.id as string;

    const res = await request(app)
      .put(`/api/brands/${id}`)
      .set(asOrg(t.organizationId))
      .send({ categoryId: t.otherCategoryId });

    expect(res.status).toBe(422);
    expect(
      (await prisma.brand.findUniqueOrThrow({ where: { id } })).categoryId
    ).toBe(t.categoryId);
  });

  it("scopes name uniqueness to the category, not just the tenant", async () => {
    // `@@unique([name, categoryId, organizationId])`. Same name in two
    // categories of one tenant: legal. Same name twice in one category: not.
    const mine = await prisma.category.create({
      data: { name: unique("Category"), organizationId: t.organizationId },
    });

    const name = "Twin " + unique("");

    const first = await request(app)
      .post("/api/brands")
      .set(asOrg(t.organizationId))
      .send(form({ name }));

    expect(first.status).toBe(201);

    // Same tenant, different category.
    const second = await request(app)
      .post("/api/brands")
      .set(asOrg(t.organizationId))
      .send(form({ name, categoryId: mine.id }));

    expect(second.status).toBe(201);

    // Same tenant, same category.
    const third = await request(app)
      .post("/api/brands")
      .set(asOrg(t.organizationId))
      .send(form({ name, categoryId: mine.id }));

    expect(third.status).toBe(409);
    expect(third.body).toMatchObject(errorBody.unique);
  });

  it("requires a category, because the column is not nullable", async () => {
    // The shared schema had no `categoryId` at all while the model declares it a
    // required foreign key, so nothing built from that schema could create a
    // valid brand. It is required and not blankable: there is no null to clear.
    for (const body of [form({ categoryId: undefined }), form({ categoryId: "" })]) {
      const res = await request(app).post("/api/brands").set(asOrg(t.organizationId)).send(body);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject(errorBody.validation);
    }
  });

  it("ignores an organizationId in the body", async () => {
    // It used to be in the shared schema, and `addBrand` overwrote whatever the
    // form sent -- so a caller naming another organization got a brand in their
    // own tenant and a success message. The field is no longer accepted.
    const res = await request(app)
      .post("/api/brands")
      .set(asOrg(t.organizationId))
      .send({ ...form(), organizationId: t.otherOrganizationId });

    expect(res.status).toBe(201);
    expect(
      (await prisma.brand.findUniqueOrThrow({ where: { id: res.body.id } })).organizationId
    ).toBe(t.organizationId);
  });

  it("refuses to delete a brand products still use", async () => {
    // `Product.brandId` is a non-nullable foreign key, so the seeded brand cannot
    // go. The count is scoped to the caller's tenant.
    const res = await request(app)
      .delete(`/api/brands/${t.brandId}`)
      .set(asOrg(t.organizationId));

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "BRAND_IN_USE" });
    expect(await prisma.brand.findUnique({ where: { id: t.brandId } })).not.toBeNull();
  });

  it("deletes a brand nothing uses", async () => {
    const created = await request(app)
      .post("/api/brands")
      .set(asOrg(t.organizationId))
      .send(form());

    const id = created.body.id as string;

    const res = await request(app)
      .delete(`/api/brands/${id}`)
      .set(asOrg(t.organizationId));

    expect(res.status).toBe(204);
    expect(await prisma.brand.findUnique({ where: { id } })).toBeNull();
  });

  it("filters by category and rejects an empty filter", async () => {
    // A dropdown that submits "" means "no category", so treating that as "all
    // categories" would quietly widen the result set. Rejected, not ignored.
    const filtered = await request(app)
      .get(`/api/brands?categoryId=${t.categoryId}`)
      .set(asOrg(t.organizationId));

    expect(filtered.status).toBe(200);
    expect(filtered.body.total).toBeGreaterThan(0);

    const empty = await request(app)
      .get("/api/brands?categoryId=")
      .set(asOrg(t.organizationId));

    expect(empty.status).toBe(400);
  });

  it("hides another tenant's brand from read, update and delete", async () => {
    for (const verb of ["get", "put", "delete"] as const) {
      const req = request(app)[verb](`/api/brands/${t.otherBrandId}`).set(
        asOrg(t.organizationId)
      );

      const res = await (verb === "put" ? req.send({ name: "Hijacked" }) : req);
      expect(res.status).toBe(404);
    }
  });

  it("requires an organization header", async () => {
    const res = await request(app).get("/api/brands");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.organizationRequired);
  });
});

if (!hasDatabase) {
  describe("Checkpoint 2i — database", () => {
    it(`skipped: ${skipReason}`, () => expect(hasDatabase).toBe(false));
  });
}
