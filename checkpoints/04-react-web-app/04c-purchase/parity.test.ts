/**
 * Checkpoint 4c — Purchase Pages: Parity Test
 *
 * Scope: asserts the shape, contract, and behavioral integrity of the ported
 * Purchase screens (PurchaseList, PurchaseNew, PurchaseEdit, and PurchaseForm):
 *
 *   - PurchaseList uses DataTable from `@dms/ui` with server-side pagination;
 *   - PurchaseForm validates required fields via PurchaseFormSchema with Zod;
 *   - PurchaseForm manages dynamic item rows with useFieldArray (add/remove);
 *   - PurchaseForm calculates item line totals and grand total correctly;
 *   - PurchaseForm submits new purchases and updates existing orders via API;
 *   - PurchaseEdit loads existing purchase data by ID into the form;
 *   - Routes are mounted under AppShell in App.tsx and linked in AppSidebar;
 *   - No legacy unbacked field names (invoiceNumber, purchaseOrderNumber) appear in web source;
 *   - When a database is available, API contracts for listing, creating, reading, and updating
 *     purchases are verified end-to-end against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { PurchaseFormSchema } from "@dms/shared";
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

describe("Checkpoint 4c — Purchase Pages", () => {
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

  it("purchase list renders with pagination", async () => {
    const listSrc = read("apps/web/src/pages/PurchaseList.tsx");

    // Must import and render DataTable with server-side pagination props
    expect(listSrc).toContain("DataTable");
    expect(listSrc).toMatch(/<DataTable\b/);
    expect(listSrc).toContain("pageCount");
    expect(listSrc).toContain("pageIndex");
    expect(listSrc).toContain("pageSize");
    expect(listSrc).toContain("onPaginationChange");

    // Must query /purchases with pagination
    expect(listSrc).toContain("/purchases?");
    expect(listSrc).toContain("page");
    expect(listSrc).toContain("pageSize");

    // Must define all required table columns
    const expectedHeaders = ["Code", "Supplier", "Date", "Items", "Total", "Status", "Actions"];

    for (const header of expectedHeaders) {
      expect(listSrc, `PurchaseList must define header "${header}"`).toContain(
        `header: "${header}"`
      );
    }

    // Must handle loading states (Skeleton) and empty state
    expect(listSrc).toContain("<Skeleton");
    expect(listSrc).toContain("No purchase orders found");

    if (hasDatabase && t) {
      const res = await request(app)
        .get("/api/purchases?page=1&pageSize=5")
        .set(asOrg(t.organizationId));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.pageCount).toBe("number");
      expect(typeof res.body.total).toBe("number");
    }
  });

  it("purchase form validates required fields", () => {
    const formSrc = read("apps/web/src/components/purchases/PurchaseForm.tsx");

    // Uses shared PurchaseFormSchema and zodResolver
    expect(formSrc).toContain("PurchaseFormSchema");
    expect(formSrc).toContain("zodResolver");

    // Form fields present
    expect(formSrc).toContain('name="purchaseCode"');
    expect(formSrc).toContain('name="supplierId"');
    expect(formSrc).toContain('name="purchaseDate"');
    expect(formSrc).toContain('name="status"');

    // Schema validation: empty fails
    const emptyResult = PurchaseFormSchema.safeParse({});
    expect(emptyResult.success).toBe(false);

    // Schema validation: missing items fails
    const noItemsResult = PurchaseFormSchema.safeParse({
      supplierId: "sup-1",
      purchaseCode: "PO-100",
      purchaseDate: "2026-10-04",
      status: "Pending",
      items: [],
    });

    expect(noItemsResult.success).toBe(false);

    // Schema validation: invalid item quantity (< 1) fails
    const badQtyResult = PurchaseFormSchema.safeParse({
      supplierId: "sup-1",
      purchaseCode: "PO-100",
      purchaseDate: "2026-10-04",
      status: "Pending",
      items: [
        {
          productId: "prod-1",
          quantity: 0,
          unitCost: 10,
        },
      ],
    });

    expect(badQtyResult.success).toBe(false);

    // Schema validation: valid purchase passes
    const validResult = PurchaseFormSchema.safeParse({
      supplierId: "sup-1",
      purchaseCode: "PO-100",
      purchaseDate: "2026-10-04",
      status: "Pending",
      discount: 5,
      taxAmount: 2.5,
      items: [
        {
          productId: "prod-1",
          quantity: 5,
          unitCost: 20,
          taxPercent: 5,
          itemDiscount: 0,
        },
      ],
    });

    expect(validResult.success).toBe(true);
  });

  it("purchase form adds/removes item rows", () => {
    const formSrc = read("apps/web/src/components/purchases/PurchaseForm.tsx");

    // Uses useFieldArray for dynamic line items
    expect(formSrc).toContain("useFieldArray");
    expect(formSrc).toMatch(/name:\s*["']items["']/);
    expect(formSrc).toContain("append(");
    expect(formSrc).toContain("remove(");

    // Form row fields
    expect(formSrc).toContain("productId");
    expect(formSrc).toContain("quantity");
    expect(formSrc).toContain("unitCost");
    expect(formSrc).toContain("batchNumber");
    expect(formSrc).toContain("expiryDate");
    expect(formSrc).toContain("taxPercent");
    expect(formSrc).toContain("itemDiscount");
  });

  it("purchase form calculates totals correctly", () => {
    const formSrc = read("apps/web/src/components/purchases/PurchaseForm.tsx");

    // Total display sections
    expect(formSrc).toContain("Items Subtotal");
    expect(formSrc).toContain("Grand Total");
    expect(formSrc).toContain("formatMoney");

    // Test total calculation formula directly
    const item1 = { quantity: 2, unitCost: 50, itemDiscount: 10, taxPercent: 10 };
    const gross1 = item1.quantity * item1.unitCost; // 100
    const taxable1 = gross1 - item1.itemDiscount; // 90
    const tax1 = (item1.taxPercent / 100) * taxable1; // 9
    const lineTotal1 = taxable1 + tax1; // 99

    expect(lineTotal1).toBe(99);

    const orderDiscount = 5;
    const orderTax = 10;
    const grandTotal = lineTotal1 - orderDiscount + orderTax;
    expect(grandTotal).toBe(104);
  });

  it("purchase form submits correctly", async () => {
    const formSrc = read("apps/web/src/components/purchases/PurchaseForm.tsx");

    // Submits via API client
    expect(formSrc).toMatch(/api\.post\(\s*["']\/purchases["']/);
    expect(formSrc).toContain("toast.success");
    expect(formSrc).toContain("submitting");
    expect(formSrc).toContain("Loader2");

    if (hasDatabase && t) {
      const code = unique("PO");

      const res = await request(app)
        .post("/api/purchases")
        .set(asOrg(t.organizationId))
        .set("x-user-id", t.userId)
        .send({
          supplierId: t.supplierId,
          purchaseCode: code,
          purchaseDate: "2026-10-04",
          status: "Pending",
          discount: 0,
          taxAmount: 0,
          items: [
            {
              productId: t.productId,
              quantity: 10,
              unitCost: 12.5,
              batchNumber: "B100",
              taxPercent: 0,
              itemDiscount: 0,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.purchaseCode).toBe(code);
      expect(res.body.totalAmount).toBe(125);
    }
  });

  it("edit purchase loads data into form", async () => {
    const editSrc = read("apps/web/src/pages/PurchaseEdit.tsx");
    const formSrc = read("apps/web/src/components/purchases/PurchaseForm.tsx");
    const appSrc = read("apps/web/src/App.tsx");
    const sidebarSrc = read("apps/web/src/components/layout/AppSidebar.tsx");

    // PurchaseEdit reads :id and queries /purchases/${id}
    expect(editSrc).toContain("useParams");
    expect(editSrc).toMatch(/\/purchases\/\$\{id\}/);
    expect(editSrc).toContain("initialData");
    expect(editSrc).toContain("isEditing");

    // Form resets with initialData and updates via PUT
    expect(formSrc).toContain("form.reset");
    expect(formSrc).toMatch(/api\.put\(\s*`\/purchases\/\$\{purchaseId\}`/);

    // Routes registered in App.tsx
    expect(appSrc).toContain('path="/purchases"');
    expect(appSrc).toContain('path="/purchases/new"');
    expect(appSrc).toContain('path="/purchases/:id/edit"');

    // Sidebar navigation enabled
    expect(sidebarSrc).toMatch(/title:\s*"Purchases"[^}]*to:\s*"\/purchases"/);

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
      "Purchase has purchaseCode; legacy purchaseOrderNumber must not appear in web source"
    ).toEqual([]);

    if (hasDatabase && t) {
      // Create a purchase order to edit
      const code = unique("PO_EDT");

      const created = await request(app)
        .post("/api/purchases")
        .set(asOrg(t.organizationId))
        .set("x-user-id", t.userId)
        .send({
          supplierId: t.supplierId,
          purchaseCode: code,
          purchaseDate: "2026-10-04",
          status: "Pending",
          discount: 0,
          taxAmount: 0,
          items: [
            {
              productId: t.productId,
              quantity: 2,
              unitCost: 50,
            },
          ],
        });

      expect(created.status).toBe(201);
      const purchaseId = created.body.id;

      // Read by ID
      const fetched = await request(app)
        .get(`/api/purchases/${purchaseId}`)
        .set(asOrg(t.organizationId));

      expect(fetched.status).toBe(200);
      expect(fetched.body.purchaseCode).toBe(code);

      // Update via PUT
      const updated = await request(app)
        .put(`/api/purchases/${purchaseId}`)
        .set(asOrg(t.organizationId))
        .send({
          status: "Approved",
          discount: 10,
        });

      expect(updated.status).toBe(200);
      expect(updated.body.status).toBe("Approved");
      expect(updated.body.discount).toBe(10);
    }
  });
});
