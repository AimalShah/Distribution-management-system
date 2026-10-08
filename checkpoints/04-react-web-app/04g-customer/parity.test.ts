/**
 * Checkpoint 4g — Customer Page: Parity Test
 *
 * Scope: asserts the shape, contract, and behavioral integrity of the ported
 * Customer management screen (CustomerList and CustomerDialog):
 *
 *   - CustomerList renders DataTable from `@dms/ui` with server-side pagination;
 *   - Customer search queries the API and filters results by name or code;
 *   - CustomerDialog validates required fields via CustomerSchema with Zod;
 *   - CustomerDialog handles new customer registration via POST;
 *   - CustomerDialog loads existing customer details into form state and updates via PUT;
 *   - Customer deletion removes the customer via DELETE;
 *   - Routes are mounted under AppShell in App.tsx and linked in AppSidebar;
 *   - No legacy unbacked field names appear in web source;
 *   - When a database is available, API contracts for listing, creating, reading, updating,
 *     and deleting customers are verified end-to-end against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { CustomerSchema } from "@dms/shared";
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

describe("Checkpoint 4g — Customer Page", () => {
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

  it("customer list renders with pagination", async () => {
    const listSrc = read("apps/web/src/pages/CustomerList.tsx");

    // Must import and render DataTable with server-side pagination props
    expect(listSrc).toContain("DataTable");
    expect(listSrc).toMatch(/<DataTable\b/);
    expect(listSrc).toContain("pageCount");
    expect(listSrc).toContain("pageIndex");
    expect(listSrc).toContain("pageSize");
    expect(listSrc).toContain("onPaginationChange");

    // Must query /customers with pagination
    expect(listSrc).toContain("/customers?");
    expect(listSrc).toContain("page");
    expect(listSrc).toContain("pageSize");

    // Must define all required customer table columns
    const expectedHeaders = [
      "Code",
      "Name",
      "Email",
      "Phone",
      "City",
      "Credit Limit",
      "Status",
      "Actions",
    ];

    for (const header of expectedHeaders) {
      expect(listSrc, `CustomerList must define header "${header}"`).toContain(
        `header: "${header}"`
      );
    }

    // Must handle loading states (Skeleton) and empty state
    expect(listSrc).toContain("<Skeleton");
    expect(listSrc).toContain("No customers found");

    if (hasDatabase && t) {
      const res = await request(app)
        .get("/api/customers?page=1&pageSize=5")
        .set(asOrg(t.organizationId));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.pageCount).toBe("number");
      expect(typeof res.body.total).toBe("number");
    }
  });

  it("customer search filters results", async () => {
    const listSrc = read("apps/web/src/pages/CustomerList.tsx");

    // Search input configured and passes query param
    expect(listSrc).toContain("search");
    expect(listSrc).toMatch(/params\.set\(\s*["']search["']/);
    expect(listSrc).toContain("Search customers");

    if (hasDatabase && t) {
      // Query with search term matching seeded customer
      const res = await request(app)
        .get("/api/customers?search=Parity")
        .set(asOrg(t.organizationId));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      for (const cust of res.body.data) {
        const matches =
          cust.name.includes("Parity") || cust.customerCode.includes("Parity");

        expect(matches).toBe(true);
      }
    }
  });

  it("add customer dialog opens and submits", async () => {
    const dialogSrc = read("apps/web/src/components/customers/CustomerDialog.tsx");
    const listSrc = read("apps/web/src/pages/CustomerList.tsx");

    // Uses CustomerSchema and zodResolver
    expect(dialogSrc).toContain("CustomerSchema");
    expect(dialogSrc).toContain("zodResolver");

    // Form fields present
    expect(dialogSrc).toContain('name="customerCode"');
    expect(dialogSrc).toContain('name="name"');
    expect(dialogSrc).toContain('name="email"');
    expect(dialogSrc).toContain('name="phone"');
    expect(dialogSrc).toContain('name="address"');
    expect(dialogSrc).toContain('name="city"');
    expect(dialogSrc).toContain('name="creditLimit"');
    expect(dialogSrc).toContain('name="isActive"');

    // Submits via API client
    expect(dialogSrc).toMatch(/api\.post\(\s*["']\/customers["']/);
    expect(dialogSrc).toContain("toast.success");
    expect(dialogSrc).toContain("submitting");

    // Dialog integrated into list
    expect(listSrc).toContain("CustomerDialog");

    // Schema validation checks
    const emptyResult = CustomerSchema.safeParse({});
    expect(emptyResult.success).toBe(false);

    const noNameResult = CustomerSchema.safeParse({
      customerCode: "CUST-1",
    });

    expect(noNameResult.success).toBe(false);

    const noCodeResult = CustomerSchema.safeParse({
      name: "Acme",
    });

    expect(noCodeResult.success).toBe(false);

    const badEmailResult = CustomerSchema.safeParse({
      customerCode: "CUST-1",
      name: "Acme",
      email: "not-an-email",
    });

    expect(badEmailResult.success).toBe(false);

    const validResult = CustomerSchema.safeParse({
      customerCode: "CUST-1",
      name: "Acme Inc.",
      email: "billing@acme.test",
      phone: "+1-555-0100",
      creditLimit: 5000,
      isActive: true,
    });

    expect(validResult.success).toBe(true);

    if (hasDatabase && t) {
      const code = unique("CUST_ADD");

      const res = await request(app)
        .post("/api/customers")
        .set(asOrg(t.organizationId))
        .send({
          customerCode: code,
          name: "Add Customer Test",
          email: `${code.toLowerCase()}@example.com`,
          phone: "+1-555-0199",
          city: "Denver",
          creditLimit: 2500,
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.customerCode).toBe(code);
      expect(res.body.creditLimit).toBe(2500);
      expect(res.body.name).toBe("Add Customer Test");
    }
  });

  it("edit customer loads data into dialog", async () => {
    const dialogSrc = read("apps/web/src/components/customers/CustomerDialog.tsx");
    const listSrc = read("apps/web/src/pages/CustomerList.tsx");

    // Dialog resets with existing customer data
    expect(dialogSrc).toContain("isEditing");
    expect(dialogSrc).toContain("form.reset");
    expect(dialogSrc).toMatch(/api\.put\(\s*`\/customers\/\$\{customer\.id\}`/);

    // List handles opening edit modal
    expect(listSrc).toContain("handleOpenEdit");
    expect(listSrc).toContain("setSelectedCustomer");

    if (hasDatabase && t) {
      const code = unique("CUST_EDT");

      const created = await request(app)
        .post("/api/customers")
        .set(asOrg(t.organizationId))
        .send({
          customerCode: code,
          name: "Initial Customer Name",
          city: "Austin",
          creditLimit: 1000,
          isActive: true,
        });

      expect(created.status).toBe(201);
      const id = created.body.id;

      // Update via PUT
      const updated = await request(app)
        .put(`/api/customers/${id}`)
        .set(asOrg(t.organizationId))
        .send({
          name: "Updated Customer Name",
          city: "Seattle",
          creditLimit: 5000,
        });

      expect(updated.status).toBe(200);
      expect(updated.body.name).toBe("Updated Customer Name");
      expect(updated.body.city).toBe("Seattle");
      expect(updated.body.creditLimit).toBe(5000);
    }
  });

  it("delete customer removes from list", async () => {
    const listSrc = read("apps/web/src/pages/CustomerList.tsx");
    const appSrc = read("apps/web/src/App.tsx");
    const sidebarSrc = read("apps/web/src/components/layout/AppSidebar.tsx");

    // Delete handler and API call
    expect(listSrc).toContain("handleDelete");
    // Checkpoint 17: the delete runs behind the shared ConfirmDialog.
    expect(listSrc).toMatch(/api\.delete\(\s*`\/customers\/\$\{confirmTarget\.id\}`/);
    expect(listSrc).toContain("ConfirmDialog");
    expect(listSrc).not.toContain("window.confirm");
    expect(listSrc).toContain("toast.success");

    // Route mounted in App.tsx
    expect(appSrc).toContain('path="/customers"');

    // Sidebar navigation enabled
    expect(sidebarSrc).toMatch(/title:\s*"Customers"[^}]*to:\s*"\/customers"/);

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
      const code = unique("CUST_DEL");

      const created = await request(app)
        .post("/api/customers")
        .set(asOrg(t.organizationId))
        .send({
          customerCode: code,
          name: "Deletable Customer",
          isActive: true,
        });

      expect(created.status).toBe(201);
      const id = created.body.id;

      // Delete customer
      const delRes = await request(app)
        .delete(`/api/customers/${id}`)
        .set(asOrg(t.organizationId));

      expect(delRes.status).toBe(204);

      // Verify customer is gone
      const fetchRes = await request(app)
        .get(`/api/customers/${id}`)
        .set(asOrg(t.organizationId));

      expect(fetchRes.status).toBe(404);
    }
  });
});
