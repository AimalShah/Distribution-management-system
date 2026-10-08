/**
 * Checkpoint 2h — Category API: Parity Test
 *
 * Scope: the composite unique, which is the opposite shape to a supplier code.
 *
 * `Category` carries `@@unique([name, organizationId])`, so a category name is
 * unique *within a tenant* and free across tenants. Two tenants may both have
 * "Beverages"; one tenant may not have two. A mock answers 201 to both, so the
 * difference is only observable against the real index -- and it is the reason
 * the 02f and 02g suites' "globally unique" cases cannot be reused here.
 *
 * The delete guard is the second half. `Product.categoryId` and
 * `Brand.categoryId` are plain foreign keys with no organization of their own,
 * so a category in use cannot be deleted: the database refuses with P2003. The
 * service counts both relations first, scoped to the caller's tenant, and answers
 * 409 with the counts -- the error the caller can act on, rather than a message
 * that describes neither cause.
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

describe.skipIf(!hasDatabase)("Checkpoint 2h — Category API", () => {
  let t: Tenant;

  beforeAll(async () => {
    t = await seedTenants();
  });

  afterAll(async () => {
    if (t) await teardownTenants(t);
  });

  const form = (over: Record<string, unknown> = {}) => ({
    name: unique("Category"),
    ...over,
  });

  it("creates a category scoped to the caller's tenant", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set(asOrg(t.organizationId))
      .send(form({ name: "Beverages", description: "Drinks" }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Beverages", description: "Drinks" });

    const row = await prisma.category.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.organizationId).toBe(t.organizationId);
  });

  it("scopes name uniqueness to the tenant, not the table", async () => {
    // `@@unique([name, organizationId])`. The same name in both tenants is legal,
    // twice in one tenant is not. Both halves are needed: a mock or a naive
    // global index would pass one and fail the other.
    const name = "Shared Name " + unique("");

    const mine = await request(app)
      .post("/api/categories")
      .set(asOrg(t.organizationId))
      .send(form({ name }));

    expect(mine.status).toBe(201);

    const theirs = await request(app)
      .post("/api/categories")
      .set(asOrg(t.otherOrganizationId))
      .send(form({ name }));

    expect(theirs.status).toBe(201);
    expect(theirs.body.id).not.toBe(mine.body.id);

    const duplicate = await request(app)
      .post("/api/categories")
      .set(asOrg(t.organizationId))
      .send(form({ name }));

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toMatchObject(errorBody.unique);
  });

  it("clears a description that a blank box is meant to clear", async () => {
    // The legacy update spread `...(data.description && { description })`. An
    // empty string is falsy, so the key was dropped, the old value survived, and
    // the caller was told it had worked.
    const created = await request(app)
      .post("/api/categories")
      .set(asOrg(t.organizationId))
      .send(form({ description: "Original" }));

    const cleared = await request(app)
      .put(`/api/categories/${created.body.id}`)
      .set(asOrg(t.organizationId))
      .send({ description: "" });

    expect(cleared.status).toBe(200);
    expect(cleared.body.description).toBeNull();
    expect(
      (await prisma.category.findUniqueOrThrow({ where: { id: created.body.id } })).description
    ).toBeNull();
  });

  it("renames without tripping over itself", async () => {
    // A PUT that does not change the name must not collide with the row's own
    // current name, which is the failure a unique index with no "unless this row"
    // clause would produce.
    const created = await request(app)
      .post("/api/categories")
      .set(asOrg(t.organizationId))
      .send(form({ name: "Original Name " + unique("") }));

    const same = await request(app)
      .put(`/api/categories/${created.body.id}`)
      .set(asOrg(t.organizationId))
      .send({ name: created.body.name });

    expect(same.status).toBe(200);

    const renamed = await request(app)
      .put(`/api/categories/${created.body.id}`)
      .set(asOrg(t.organizationId))
      .send({ name: "Renamed " + unique("") });

    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe("Renamed " + renamed.body.name.split(" ")[1]);
  });

  it("refuses to delete a category that products or brands still use", async () => {
    // The seeded category holds one product and one brand, so both counters are
    // non-zero. `P2003` would refuse the delete anyway; the guard exists so the
    // caller is told which relations are in the way.
    const res = await request(app)
      .delete(`/api/categories/${t.categoryId}`)
      .set(asOrg(t.organizationId));

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "CATEGORY_IN_USE" });
    expect(res.body.details).toMatchObject({ productCount: 1, brandCount: 1 });
    expect(await prisma.category.findUnique({ where: { id: t.categoryId } })).not.toBeNull();
  });

  it("deletes a category nothing uses", async () => {
    const created = await request(app)
      .post("/api/categories")
      .set(asOrg(t.organizationId))
      .send(form());

    const id = created.body.id as string;

    const res = await request(app)
      .delete(`/api/categories/${id}`)
      .set(asOrg(t.organizationId));

    expect(res.status).toBe(204);
    expect(await prisma.category.findUnique({ where: { id } })).toBeNull();
  });

  it("counts products and brands rather than embedding them", async () => {
    // The legacy list embedded every brand in every category. Nothing read it --
    // the only consumer is the product and inventory category dropdown, which
    // needs to tell "empty" from "not loaded".
    const res = await request(app).get("/api/categories").set(asOrg(t.organizationId));

    expect(res.status).toBe(200);
    expect(res.body.data[0]._count).toHaveProperty("products");
    expect(res.body.data[0]._count).toHaveProperty("brands");
    expect(res.body.data[0].brands).toBeUndefined();
  });

  it("hides another tenant's category from read, update and delete", async () => {
    for (const verb of ["get", "put", "delete"] as const) {
      const req = request(app)[verb](`/api/categories/${t.otherCategoryId}`).set(
        asOrg(t.organizationId)
      );

      const res = await (verb === "put" ? req.send({ name: "Hijacked" }) : req);
      expect(res.status).toBe(404);
    }

    expect(
      await prisma.category.findUniqueOrThrow({ where: { id: t.otherCategoryId } })
    ).toMatchObject({ organizationId: t.otherOrganizationId });
  });

  it("requires an organization header", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.organizationRequired);
  });
});

if (!hasDatabase) {
  describe("Checkpoint 2h — database", () => {
    it(`skipped: ${skipReason}`, () => expect(hasDatabase).toBe(false));
  });
}
