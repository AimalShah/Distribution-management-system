import fs from "node:fs";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@dms/db";
import { createApp } from "../app";
import { ORGANIZATION_HEADER, USER_ENV_VAR, USER_HEADER } from "./auth-context";

/**
 * The two fields `getMemberPermissions` reads off a membership row. Named
 * because the stand-in below is built from it rather than from `unknown`, and
 * the row is the whole contract a request path has with the table.
 */
interface MemberRow {
  readonly role: string;
  readonly customRole: {
    readonly permissions: readonly { readonly resource: string; readonly action: string }[];
  } | null;
}

// SAFETY: a stand-in row carries only the fields the request path reads, and
// every assertion below is on the status and code the mounted stack returns
// rather than on the shape of the row that produced them.
const stub = <T>(row: T): never => row as never;

const app = createApp();

const ORG = "org_rbac";

const USER = "usr_rbac";

const validProduct = {
  name: "Bench Product",
  productCode: "RBAC-001",
  category: "cat_1",
  unit: "pcs",
  brand: "brand_1",
  description: "",
  unitCost: "10.00",
  unitPrice: "20.00",
  isActive: true,
};

const memberSpy = vi.spyOn(prisma.member, "findFirst");

const findManySpy = vi.spyOn(prisma.product, "findMany");

const countSpy = vi.spyOn(prisma.product, "count");

const createSpy = vi.spyOn(prisma.product, "create");

const deleteSpy = vi.spyOn(prisma.product, "delete");

const categorySpy = vi.spyOn(prisma.category, "findFirst");

const brandSpy = vi.spyOn(prisma.brand, "findFirst");

const asMember = (row: MemberRow) => memberSpy.mockResolvedValue(stub(row));

const ROUTES_SOURCE = fs.readFileSync(new URL("../routes/index.ts", import.meta.url), "utf8");

/**
 * The seam, asked through the mounted application rather than through the
 * middleware in isolation. The claim under test is the ordinary one a product
 * owner would make -- "a sales role cannot delete a product" -- so the route
 * is the real router behind the real guard, and only the two rows the guard
 * reads are stood in.
 *
 * The default below is deliberately the denying one: a member row that is not
 * there grants nothing, which is what keeps an unfinished test from passing by
 * omission.
 */
beforeEach(() => {
  memberSpy.mockClear().mockResolvedValue(stub(null));
  findManySpy.mockClear().mockResolvedValue(stub([]));
  countSpy.mockClear().mockResolvedValue(stub(0));
  createSpy.mockClear().mockResolvedValue(stub({ id: "prod_new" }));
  deleteSpy.mockClear().mockResolvedValue(stub({ id: "prod_1" }));
  categorySpy.mockClear().mockResolvedValue(stub({ id: "cat_1" }));
  brandSpy.mockClear().mockResolvedValue(stub({ id: "brand_1" }));
});

describe("route permission enforcement", () => {
  it("refuses the product writes a sales representative's role does not grant", async () => {
    // The custom role narrows the row: it speaks for the member, and what it
    // says is `sales:view` and nothing else.
    asMember({
      role: "sales",
      customRole: { permissions: [{ resource: "sales", action: "view" }] },
    });

    const deleted = await request(app)
      .delete("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, ORG)
      .set(USER_HEADER, USER);

    expect(deleted.status).toBe(403);
    expect(deleted.body.code).toBe("PERMISSION_DENIED");
    expect(deleteSpy).not.toHaveBeenCalled();

    const created = await request(app)
      .post("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .set(USER_HEADER, USER)
      .send(validProduct);

    expect(created.status).toBe(403);
    expect(created.body.code).toBe("PERMISSION_DENIED");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("lets an owner the very calls it refuses the representative", async () => {
    asMember({ role: "owner", customRole: null });

    const deleted = await request(app)
      .delete("/api/products/prod_1")
      .set(ORGANIZATION_HEADER, ORG)
      .set(USER_HEADER, USER);

    expect(deleted.status).toBe(204);
    expect(deleteSpy).toHaveBeenCalledWith({
      where: { id: "prod_1", organizationId: ORG },
    });

    const created = await request(app)
      .post("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .set(USER_HEADER, USER)
      .send(validProduct);

    expect(created.status).toBe(201);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it("lets a plain member read the same products", async () => {
    asMember({ role: "member", customRole: null });

    const res = await request(app)
      .get("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .set(USER_HEADER, USER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], pageCount: 0, total: 0 });
    expect(findManySpy).toHaveBeenCalledTimes(1);
  });

  it("refuses a caller this tenant has no membership row for", async () => {
    const res = await request(app)
      .get("/api/products")
      .set(ORGANIZATION_HEADER, ORG)
      .set(USER_HEADER, USER);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PERMISSION_DENIED");
    expect(findManySpy).not.toHaveBeenCalled();
  });

  it("refuses a request with no user to attribute the action to", async () => {
    vi.stubEnv(USER_ENV_VAR, "");
    asMember({ role: "owner", customRole: null });

    const res = await request(app).get("/api/products").set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(findManySpy).not.toHaveBeenCalled();
  });

  it("refuses a request with no organization to act in", async () => {
    vi.stubEnv(USER_ENV_VAR, "");
    asMember({ role: "owner", customRole: null });

    const res = await request(app).get("/api/products").set(USER_HEADER, USER);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(findManySpy).not.toHaveBeenCalled();
  });
});

describe("the permission table is the mount's own coverage", () => {
  const tableSource = ROUTES_SOURCE.slice(
    ROUTES_SOURCE.indexOf("const PERMISSIONS: RoutePermissionTable = {"),
    ROUTES_SOURCE.indexOf("apiRouter.use(requireRoutePermission(PERMISSIONS))")
  );

  it("names a row for every router mounted under /api", () => {
    const mounted = [...ROUTES_SOURCE.matchAll(/apiRouter\.use\("\/([^"]+)"/gu)].map((match) =>
      match[1].split("/")[0]
    );

    const guarded = [...tableSource.matchAll(/^ {2}([a-z][a-zA-Z]*):/gmu)].map(
      (match) => match[1]
    );

    expect(guarded.length).toBeGreaterThan(0);
    expect([...new Set(guarded)].sort()).toEqual([...new Set(mounted)].sort());
  });

  it("mounts the guard ahead of the first router", () => {
    const guardIndex = ROUTES_SOURCE.indexOf("apiRouter.use(requireRoutePermission(PERMISSIONS))");
    const firstRouterIndex = ROUTES_SOURCE.indexOf('apiRouter.use("/products"');

    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(firstRouterIndex);
  });
});
