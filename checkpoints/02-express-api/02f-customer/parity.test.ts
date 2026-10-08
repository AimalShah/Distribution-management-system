/**
 * Checkpoint 2f — Customer API: Parity Test
 *
 * Scope: the two things the mocked suite cannot see.
 *
 * 1. `Customer.customerCode` is `@unique` with no organization in the key, so a
 *    code is a global name. Two tenants cannot both use `C-0001`, and that is a
 *    database fact rather than a validation rule -- a mocked `customer.create`
 *    accepts the second one without complaint.
 * 2. The delete guard counts real `Sale` rows. `source-review.md` notes the
 *    legacy `deleteCustomer` took no organization at all, so any member could
 *    delete another tenant's customer; the guard now scopes the count to the
 *    caller's tenant and answers 409 before the database would have refused with
 *    P2003.
 *
 * The credit-limit case is the odd one. It is a pure input-mapping test, and it
 * is here because `customer.ts` calls it out as a fixed bug: the legacy service
 * ran `data.creditLimit ? Number(data.creditLimit) : null`, so a limit of exactly
 * 0 was stored as "no limit". Worth pinning, since a naive port would reintroduce
 * it and no database constraint would complain.
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

describe.skipIf(!hasDatabase)("Checkpoint 2f — Customer API", () => {
  let t: Tenant;

  beforeAll(async () => {
    t = await seedTenants();
  });

  afterAll(async () => {
    if (t) await teardownTenants(t);
  });

  const form = (over: Record<string, unknown> = {}) => ({
    customerCode: unique("C"),
    name: "Parity Customer",
    ...over,
  });

  it("creates a customer scoped to the caller's tenant", async () => {
    const res = await request(app)
      .post("/api/customers")
      .set(asOrg(t.organizationId))
      .send(form({ name: "Created By Parity" }));

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Created By Parity");
    // Absent means active, which is the column default.
    expect(res.body.isActive).toBe(true);

    const row = await prisma.customer.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.organizationId).toBe(t.organizationId);
  });

  it("treats customerCode as globally unique, across tenants", async () => {
    const code = unique("C");

    const first = await request(app)
      .post("/api/customers")
      .set(asOrg(t.organizationId))
      .send(form({ customerCode: code }));

    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/customers")
      .set(asOrg(t.otherOrganizationId))
      .send(form({ customerCode: code, name: "Other tenant, same code" }));

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject(errorBody.unique);
  });

  it("keeps a credit limit of exactly zero", async () => {
    // `data.creditLimit ? Number(...) : null` stored 0 as null, so "no credit at
    // all" and "never recorded" were the same row. `null` now means only the
    // latter.
    const zero = await request(app)
      .post("/api/customers")
      .set(asOrg(t.organizationId))
      .send(form({ creditLimit: 0 }));

    expect(zero.status).toBe(201);
    expect(zero.body.creditLimit).toBe(0);

    const stored = await prisma.customer.findUniqueOrThrow({ where: { id: zero.body.id } });
    expect(stored.creditLimit).toBe(0);

    // And a blank still clears the column to null.
    const cleared = await request(app)
      .put(`/api/customers/${zero.body.id}`)
      .set(asOrg(t.organizationId))
      .send({ creditLimit: "" });

    expect(cleared.status).toBe(200);
    expect(cleared.body.creditLimit).toBeNull();
  });

  it("does not reactivate a deactivated customer on an unrelated update", async () => {
    // `CustomerSchema.partial()` would have kept `isActive`'s `.default(true)`, so
    // a PUT that omitted it would silently switch the customer back on.
    const created = await request(app)
      .post("/api/customers")
      .set(asOrg(t.organizationId))
      .send(form());

    const id = created.body.id as string;

    const off = await request(app)
      .put(`/api/customers/${id}`)
      .set(asOrg(t.organizationId))
      .send({ isActive: false });

    expect(off.body.isActive).toBe(false);

    const renamed = await request(app)
      .put(`/api/customers/${id}`)
      .set(asOrg(t.organizationId))
      .send({ name: "Renamed" });

    expect(renamed.status).toBe(200);
    expect(renamed.body.isActive).toBe(false);
    expect(renamed.body.name).toBe("Renamed");
  });

  it("clears a field that a blank box is meant to clear", async () => {
    // The legacy update spread `...(data.phone && { phone })`, and an empty
    // string is falsy, so clearing the box left the old value in place and
    // reported success.
    const created = await request(app)
      .post("/api/customers")
      .set(asOrg(t.organizationId))
      .send(form({ email: "someone@example.test", phone: "0300-1234567", city: "Karachi" }));

    expect(created.body.email).toBe("someone@example.test");

    const cleared = await request(app)
      .put(`/api/customers/${created.body.id}`)
      .set(asOrg(t.organizationId))
      .send({ email: "", phone: "  ", city: "" });

    expect(cleared.status).toBe(200);
    expect(cleared.body.email).toBeNull();
    expect(cleared.body.phone).toBeNull();
    expect(cleared.body.city).toBeNull();
  });

  it("filters isActive=false as false rather than as a truthy string", async () => {
    // `z.coerce.boolean()` maps the string "false" to true, so a naive port
    // would answer an archived-only filter with the active ones.
    const active = await request(app)
      .post("/api/customers")
      .set(asOrg(t.organizationId))
      .send(form({ isActive: true }));

    const archived = await request(app)
      .post("/api/customers")
      .set(asOrg(t.organizationId))
      .send(form({ isActive: false }));

    const filtered = await request(app)
      .get("/api/customers?isActive=false")
      .set(asOrg(t.organizationId));

    expect(filtered.status).toBe(200);
    const ids = filtered.body.data.map((c: { id: string }) => c.id);
    expect(ids).toContain(archived.body.id);
    expect(ids).not.toContain(active.body.id);
    expect(filtered.body.data.every((c: { isActive: boolean }) => c.isActive === false)).toBe(true);
  });

  it("refuses to delete a customer with sales history", async () => {
    // The count is scoped to the caller's tenant, so the other tenant's sales
    // against the same customer id do not block this one.
    const created = await request(app)
      .post("/api/customers")
      .set(asOrg(t.organizationId))
      .send(form());

    const id = created.body.id as string;

    await prisma.sale.create({
      data: {
        saleCode: unique("SO"),
        organizationId: t.organizationId,
        customerId: id,
        totalAmount: 10,
        status: "Completed",
        saleDate: new Date("2026-01-15T00:00:00.000Z"),
      },
    });

    const res = await request(app)
      .delete(`/api/customers/${id}`)
      .set(asOrg(t.organizationId));

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "CUSTOMER_HAS_SALES" });
    expect(await prisma.customer.findUnique({ where: { id } })).not.toBeNull();
  });

  it("deletes an unused customer", async () => {
    const created = await request(app)
      .post("/api/customers")
      .set(asOrg(t.organizationId))
      .send(form());

    const id = created.body.id as string;

    const res = await request(app)
      .delete(`/api/customers/${id}`)
      .set(asOrg(t.organizationId));

    expect(res.status).toBe(204);
    expect(await prisma.customer.findUnique({ where: { id } })).toBeNull();
  });

  it("counts sales on the row instead of embedding them", async () => {
    // The legacy detail returned the customer's whole sales history inline. A
    // count is what the list and detail both send now.
    const res = await request(app)
      .get(`/api/customers/${t.customerId}`)
      .set(asOrg(t.organizationId));

    expect(res.status).toBe(200);
    expect(res.body._count.sale).toBe(0);
    expect(res.body.sale).toBeUndefined();
  });

  it("hides another tenant's customer from read, update and delete", async () => {
    // The legacy `deleteCustomer` took no organization, so any member could
    // remove another tenant's row. All three verbs have to be scoped now.
    for (const verb of ["get", "put", "delete"] as const) {
      const req = request(app)[verb](`/api/customers/${t.otherCustomerId}`).set(
        asOrg(t.organizationId)
      );

      const res = await (verb === "put" ? req.send({ name: "Hijacked" }) : req);
      expect(res.status).toBe(404);
    }

    expect(
      await prisma.customer.findUniqueOrThrow({ where: { id: t.otherCustomerId } })
    ).toMatchObject({ name: "Parity Customer (other tenant)" });
  });

  it("requires an organization header", async () => {
    const res = await request(app).get("/api/customers");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.organizationRequired);
  });
});

if (!hasDatabase) {
  describe("Checkpoint 2f — database", () => {
    it(`skipped: ${skipReason}`, () => expect(hasDatabase).toBe(false));
  });
}
