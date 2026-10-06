/**
 * Checkpoint 4h — Supplier Page: Parity Test
 *
 * Scope: asserts the shape, contract, and behavioral integrity of the ported
 * Supplier management screen (SupplierList and SupplierDialog):
 *
 *   - SupplierList renders DataTable from `@dms/ui` with server-side pagination;
 *   - SupplierList handles search and status filtering;
 *   - SupplierDialog validates required fields via SupplierSchema with Zod;
 *   - SupplierDialog handles new supplier registration via POST;
 *   - SupplierDialog loads existing supplier details into form state and updates via PUT;
 *   - Supplier deletion removes the supplier via DELETE;
 *   - Routes are mounted under AppShell in App.tsx and linked in AppSidebar;
 *   - No legacy unbacked field names appear in web source;
 *   - When a database is available, API contracts for listing, creating, reading, updating,
 *     and deleting suppliers are verified end-to-end against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { SupplierSchema } from "@dms/shared";
import {
  app,
  asOrg,
  hasDatabase,
  prisma,
  request,
  seedTenants,
  teardownTenants,
  unique,
  type Tenant,
} from "../../support/parity-db";

const root = path.resolve(__dirname, "../../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);
  return fs.readFileSync(full, "utf-8");
};

describe("Checkpoint 4h — Supplier Page", () => {
  let t: Tenant;

  beforeAll(async () => {
    if (hasDatabase) {
      t = await seedTenants();
    }
  });

  afterAll(async () => {
    if (hasDatabase && t) {
      await teardownTenants(t);
    }
  });

  it("supplier list renders with pagination", async () => {
    const listSrc = read("apps/web/src/pages/SupplierList.tsx");

    // Must import and render DataTable with server-side pagination props
    expect(listSrc).toContain("DataTable");
    expect(listSrc).toMatch(/<DataTable\b/);
    expect(listSrc).toContain("pageCount");
    expect(listSrc).toContain("pageIndex");
    expect(listSrc).toContain("pageSize");
    expect(listSrc).toContain("onPaginationChange");

    // Must query /suppliers with pagination
    expect(listSrc).toContain("/suppliers?");
    expect(listSrc).toContain("page");
    expect(listSrc).toContain("pageSize");

    // Must define all required supplier table columns
    const expectedHeaders = [
      "Code",
      "Company",
      "Contact Person",
      "Email",
      "Phone",
      "City",
      "Status",
      "Actions",
    ];
    for (const header of expectedHeaders) {
      expect(listSrc, `SupplierList must define header "${header}"`).toContain(
        `header: "${header}"`
      );
    }

    // Must handle loading states (Skeleton) and empty state
    expect(listSrc).toContain("<Skeleton");
    expect(listSrc).toContain("No suppliers found");

    if (hasDatabase && t) {
      const res = await request(app)
        .get("/api/suppliers?page=1&pageSize=5")
        .set(asOrg(t.organizationId));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.pageCount).toBe("number");
      expect(typeof res.body.total).toBe("number");
    }
  });

  it("add supplier dialog opens and submits", async () => {
    const dialogSrc = read("apps/web/src/components/suppliers/SupplierDialog.tsx");
    const listSrc = read("apps/web/src/pages/SupplierList.tsx");

    // Uses SupplierSchema and zodResolver
    expect(dialogSrc).toContain("SupplierSchema");
    expect(dialogSrc).toContain("zodResolver");

    // Form fields present
    expect(dialogSrc).toContain('name="supplierCode"');
    expect(dialogSrc).toContain('name="companyName"');
    expect(dialogSrc).toContain('name="contactPerson"');
    expect(dialogSrc).toContain('name="email"');
    expect(dialogSrc).toContain('name="phone"');
    expect(dialogSrc).toContain('name="address"');
    expect(dialogSrc).toContain('name="city"');
    expect(dialogSrc).toContain('name="isActive"');

    // Submits via API client
    expect(dialogSrc).toMatch(/api\.post\(\s*["']\/suppliers["']/);
    expect(dialogSrc).toContain("toast.success");
    expect(dialogSrc).toContain("submitting");

    // Dialog integrated into list
    expect(listSrc).toContain("SupplierDialog");

    // Schema validation checks
    const emptyResult = SupplierSchema.safeParse({});
    expect(emptyResult.success).toBe(false);

    const noCompanyResult = SupplierSchema.safeParse({
      supplierCode: "SUPP-1",
      contactPerson: "John",
    });
    expect(noCompanyResult.success).toBe(false);

    const noCodeResult = SupplierSchema.safeParse({
      companyName: "Acme Supplies",
      contactPerson: "John",
    });
    expect(noCodeResult.success).toBe(false);

    const badEmailResult = SupplierSchema.safeParse({
      supplierCode: "SUPP-1",
      companyName: "Acme Supplies",
      contactPerson: "John",
      email: "not-an-email",
    });
    expect(badEmailResult.success).toBe(false);

    const validResult = SupplierSchema.safeParse({
      supplierCode: "SUPP-1",
      companyName: "Acme Supplies Ltd",
      contactPerson: "John Doe",
      email: "orders@acme.test",
      phone: "+1-555-0100",
      city: "Chicago",
      isActive: true,
    });
    expect(validResult.success).toBe(true);

    if (hasDatabase && t) {
      const code = unique("SUPP_ADD");
      const res = await request(app)
        .post("/api/suppliers")
        .set(asOrg(t.organizationId))
        .send({
          supplierCode: code,
          companyName: "Add Supplier Test Ltd",
          contactPerson: "Jane Smith",
          email: `${code.toLowerCase()}@example.com`,
          phone: "+1-555-0188",
          city: "Seattle",
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.supplierCode).toBe(code);
      expect(res.body.companyName).toBe("Add Supplier Test Ltd");
      expect(res.body.contactPerson).toBe("Jane Smith");
    }
  });

  it("edit supplier loads data into dialog", async () => {
    const dialogSrc = read("apps/web/src/components/suppliers/SupplierDialog.tsx");
    const listSrc = read("apps/web/src/pages/SupplierList.tsx");

    // Dialog resets with existing supplier data
    expect(dialogSrc).toContain("isEditing");
    expect(dialogSrc).toContain("form.reset");
    expect(dialogSrc).toMatch(/api\.put\(\s*`\/suppliers\/\$\{supplier\.id\}`/);

    // List handles opening edit modal
    expect(listSrc).toContain("handleOpenEdit");
    expect(listSrc).toContain("setSelectedSupplier");

    if (hasDatabase && t) {
      const code = unique("SUPP_EDT");
      const created = await request(app)
        .post("/api/suppliers")
        .set(asOrg(t.organizationId))
        .send({
          supplierCode: code,
          companyName: "Initial Supplier Name",
          contactPerson: "Original Contact",
          city: "Dallas",
          isActive: true,
        });

      expect(created.status).toBe(201);
      const id = created.body.id;

      // Update via PUT
      const updated = await request(app)
        .put(`/api/suppliers/${id}`)
        .set(asOrg(t.organizationId))
        .send({
          companyName: "Updated Supplier Name",
          contactPerson: "New Contact",
          city: "Houston",
        });

      expect(updated.status).toBe(200);
      expect(updated.body.companyName).toBe("Updated Supplier Name");
      expect(updated.body.contactPerson).toBe("New Contact");
      expect(updated.body.city).toBe("Houston");
    }
  });

  it("delete supplier removes from list", async () => {
    const listSrc = read("apps/web/src/pages/SupplierList.tsx");
    const appSrc = read("apps/web/src/App.tsx");
    const sidebarSrc = read("apps/web/src/components/layout/AppSidebar.tsx");

    // Delete handler and API call
    expect(listSrc).toContain("handleDelete");
    expect(listSrc).toMatch(/api\.delete\(\s*`\/suppliers\/\$\{id\}`/);
    expect(listSrc).toContain("toast.success");

    // Route mounted in App.tsx
    expect(appSrc).toContain('path="/suppliers"');

    // Sidebar navigation enabled
    expect(sidebarSrc).toMatch(/title:\s*"Suppliers"[^}]*to:\s*"\/suppliers"/);

    // Legacy unbacked field names check across apps/web/src
    const webSrc = path.join(root, "apps/web/src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const source = fs.readFileSync(full, "utf-8");
          if (/invoiceNumber|purchaseOrderNumber/.test(source)) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    walk(webSrc);

    expect(
      offenders,
      "Legacy invoiceNumber and purchaseOrderNumber must not appear in web source"
    ).toEqual([]);

    if (hasDatabase && t) {
      const code = unique("SUPP_DEL");
      const created = await request(app)
        .post("/api/suppliers")
        .set(asOrg(t.organizationId))
        .send({
          supplierCode: code,
          companyName: "Deletable Supplier",
          contactPerson: "Temporary Person",
          isActive: true,
        });

      expect(created.status).toBe(201);
      const id = created.body.id;

      // Delete supplier
      const delRes = await request(app)
        .delete(`/api/suppliers/${id}`)
        .set(asOrg(t.organizationId));

      expect(delRes.status).toBe(204);

      // Verify supplier is gone
      const fetchRes = await request(app)
        .get(`/api/suppliers/${id}`)
        .set(asOrg(t.organizationId));

      expect(fetchRes.status).toBe(404);
    }
  });
});
