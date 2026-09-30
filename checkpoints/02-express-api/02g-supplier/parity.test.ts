/**
 * Checkpoint 2g — Supplier API: Parity Test
 *
 * Scope: the code's global reach and the delete guard.
 *
 * `Supplier.supplierCode` is `@unique` with no organization in the key, so a
 * supplier code is a global name and two tenants cannot share one. That is a
 * database fact, invisible to a mock.
 *
 * The delete guard is the other half. `source-review.md` flags that the legacy
 * `removeSupplier` resolved no tenant, so any member could delete another
 * company's supplier; the guard now counts purchases scoped to the caller's
 * organization and answers 409 before the foreign key would have refused with
 * P2003.
 *
 * Optionality is pinned too, because it is a port decision rather than a
 * constraint: `phone`, `address` and `city` are all `String?` in the Prisma
 * model, all three optional in `src/types/supplier.d.ts`, and the legacy service
 * wrote `data.phone || null` -- code that only makes sense if they can be absent.
 * The old shared schema was the only thing demanding them, and it was wrong.
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

describe.skipIf(!hasDatabase)("Checkpoint 2g — Supplier API", () => {
  let t: Tenant;

  beforeAll(async () => {
    t = await seedTenants();
  });

  afterAll(async () => {
    if (t) await teardownTenants(t);
  });

  // The three required fields keep their two-character minimums; the optional
  // three are genuinely optional.
  const form = (over: Record<string, unknown> = {}) => ({
    supplierCode: unique("SUP"),
    companyName: "Parity Supplier Co",
    contactPerson: "Parity Contact",
    ...over,
  });

  it("creates a supplier with no phone, address or city", async () => {
    const res = await request(app)
      .post("/api/suppliers")
      .set(asOrg(t.organizationId))
      .send(form());

    expect(res.status).toBe(201);
    expect(res.body.phone).toBeNull();
    expect(res.body.address).toBeNull();
    expect(res.body.city).toBeNull();
    expect(res.body.isActive).toBe(true);

    const row = await prisma.supplier.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.organizationId).toBe(t.organizationId);
  });

  it("enforces the two-character minimums the form asked for", async () => {
    for (const field of ["supplierCode", "companyName", "contactPerson"]) {
      const res = await request(app)
        .post("/api/suppliers")
        .set(asOrg(t.organizationId))
        .send(form({ [field]: "x" }));

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject(errorBody.validation);
    }
  });

  it("treats supplierCode as globally unique, across tenants", async () => {
    const code = unique("SUP");
    const first = await request(app)
      .post("/api/suppliers")
      .set(asOrg(t.organizationId))
      .send(form({ supplierCode: code }));
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/suppliers")
      .set(asOrg(t.otherOrganizationId))
      .send(form({ supplierCode: code, companyName: "Other tenant, same code" }));

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject(errorBody.unique);
  });

  it("does not reactivate a deactivated supplier on an unrelated update", async () => {
    const created = await request(app)
      .post("/api/suppliers")
      .set(asOrg(t.organizationId))
      .send(form());
    const id = created.body.id as string;

    const off = await request(app)
      .put(`/api/suppliers/${id}`)
      .set(asOrg(t.organizationId))
      .send({ isActive: false });
    expect(off.body.isActive).toBe(false);

    const renamed = await request(app)
      .put(`/api/suppliers/${id}`)
      .set(asOrg(t.organizationId))
      .send({ companyName: "Renamed Co" });

    expect(renamed.status).toBe(200);
    expect(renamed.body.isActive).toBe(false);
    expect(renamed.body.companyName).toBe("Renamed Co");
  });

  it("refuses to delete a supplier with purchase history", async () => {
    const created = await request(app)
      .post("/api/suppliers")
      .set(asOrg(t.organizationId))
      .send(form());
    const id = created.body.id as string;

    await prisma.purchase.create({
      data: {
        purchaseCode: unique("PO"),
        organizationId: t.organizationId,
        supplierId: id,
        totalAmount: 10,
        status: "Completed",
        purchaseDate: new Date("2026-01-15T00:00:00.000Z"),
      },
    });

    const res = await request(app)
      .delete(`/api/suppliers/${id}`)
      .set(asOrg(t.organizationId));

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "SUPPLIER_HAS_PURCHASES" });
    expect(await prisma.supplier.findUnique({ where: { id } })).not.toBeNull();
  });

  it("deletes an unused supplier", async () => {
    const created = await request(app)
      .post("/api/suppliers")
      .set(asOrg(t.organizationId))
      .send(form());
    const id = created.body.id as string;

    const res = await request(app)
      .delete(`/api/suppliers/${id}`)
      .set(asOrg(t.organizationId));

    expect(res.status).toBe(204);
    expect(await prisma.supplier.findUnique({ where: { id } })).toBeNull();
  });

  it("counts purchases on the list but not on the detail", async () => {
    // The legacy `GET /api/suppliers/:id` embedded `purchase: true` -- every
    // purchase the supplier had ever been billed on, unbounded. That embed is
    // what `GET /api/purchases/supplier/:supplierId` now exists to replace.
    const list = await request(app).get("/api/suppliers").set(asOrg(t.organizationId));
    expect(list.status).toBe(200);
    expect(list.body.data[0]._count).toHaveProperty("purchase");
    expect(list.body.data[0].purchase).toBeUndefined();

    const detail = await request(app)
      .get(`/api/suppliers/${t.supplierId}`)
      .set(asOrg(t.organizationId));
    expect(detail.status).toBe(200);
    expect(detail.body.purchase).toBeUndefined();
  });

  it("searches across code, company name and contact person", async () => {
    const needle = unique("Find");
    await request(app)
      .post("/api/suppliers")
      .set(asOrg(t.organizationId))
      .send(form({ companyName: `Acme ${needle}`, contactPerson: "Zoë Contact" }));

    const byCompany = await request(app)
      .get(`/api/suppliers?search=${needle}`)
      .set(asOrg(t.organizationId));
    expect(byCompany.body.total).toBe(1);

    const byContact = await request(app)
      .get("/api/suppliers?search=Zoë")
      .set(asOrg(t.organizationId));
    expect(byContact.body.data[0].contactPerson).toBe("Zoë Contact");
  });

  it("hides another tenant's supplier from read, update and delete", async () => {
    for (const verb of ["get", "put", "delete"] as const) {
      const req = request(app)[verb](`/api/suppliers/${t.otherSupplierId}`).set(
        asOrg(t.organizationId)
      );
      const res = await (verb === "put" ? req.send({ companyName: "Hijacked" }) : req);
      expect(res.status).toBe(404);
    }

    expect(
      await prisma.supplier.findUniqueOrThrow({ where: { id: t.otherSupplierId } })
    ).toMatchObject({ companyName: "Parity Supplier (other tenant)" });
  });

  it("requires an organization header", async () => {
    const res = await request(app).get("/api/suppliers");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.organizationRequired);
  });
});

if (!hasDatabase) {
  describe("Checkpoint 2g — database", () => {
    it(`skipped: ${skipReason}`, () => expect(hasDatabase).toBe(false));
  });
}
