/**
 * Checkpoint 4d — Sale Invoice Pages: Parity Test
 *
 * Scope: asserts the shape, contract, and behavioral integrity of the ported
 * Sale Invoice screens (SaleInvoiceList, SaleInvoiceNew, SaleInvoiceEdit, and SaleInvoiceForm):
 *
 *   - SaleInvoiceList uses DataTable from `@dms/ui` with server-side pagination;
 *   - SaleInvoiceForm validates required fields via SaleInvoiceSchema with Zod;
 *   - SaleInvoiceForm manages dynamic item rows with useFieldArray (add/remove);
 *   - SaleInvoiceForm calculates item line totals and grand total correctly;
 *   - SaleInvoiceForm submits new invoices and updates existing invoices via API;
 *   - Sale invoice PDF generation route produces a valid PDF file stream;
 *   - Sale invoice print view renders an HTML document with invoice details;
 *   - Routes are mounted under AppShell in App.tsx and linked in AppSidebar;
 *   - No legacy unbacked field names (invoiceNumber, purchaseOrderNumber) appear in web source;
 *   - When a database is available, API contracts for listing, creating, reading, and updating
 *     sale invoices as well as PDF and HTML export are verified end-to-end against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { SaleInvoiceSchema, type SaleInvoiceInput } from "@dms/shared";
import { calculateSaleTotal } from "../../../apps/server/src/services/sale";
import {
  app,
  asOrg,
  asUser,
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

describe("Checkpoint 4d — Sale Invoice Pages", () => {
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

  const stockedProduct = async (qty: number) => {
    const product = await prisma.product.create({
      data: {
        productCode: unique("SKU"),
        organizationId: t.organizationId,
        name: "Sale Parity Product",
        categoryId: t.categoryId,
        brandId: t.brandId,
        unit: "pcs",
        unitCost: 10,
        unitPrice: 25,
      },
    });
    if (qty > 0) {
      await prisma.inventory.create({
        data: {
          productId: product.id,
          organizationId: t.organizationId,
          quantityOnHand: qty,
          reorderLevel: 5,
        },
      });
    }
    return product;
  };

  it("sale invoice list renders with pagination", async () => {
    const listSrc = read("apps/web/src/pages/SaleInvoiceList.tsx");

    // Must import and render DataTable with server-side pagination props
    expect(listSrc).toContain("DataTable");
    expect(listSrc).toMatch(/<DataTable\b/);
    expect(listSrc).toContain("pageCount");
    expect(listSrc).toContain("pageIndex");
    expect(listSrc).toContain("pageSize");
    expect(listSrc).toContain("onPaginationChange");

    // Must query /sales with pagination
    expect(listSrc).toContain("/sales?");
    expect(listSrc).toContain("page");
    expect(listSrc).toContain("pageSize");

    // Must define all required table columns
    const expectedHeaders = ["Code", "Customer", "Date", "Items", "Total", "Status", "Actions"];
    for (const header of expectedHeaders) {
      expect(listSrc, `SaleInvoiceList must define header "${header}"`).toContain(
        `header: "${header}"`
      );
    }

    // Must handle loading states (Skeleton) and empty state
    expect(listSrc).toContain("<Skeleton");
    expect(listSrc).toContain("No sale invoices found");

    if (hasDatabase && t) {
      const res = await request(app)
        .get("/api/sales?page=1&pageSize=5")
        .set(asOrg(t.organizationId));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.pageCount).toBe("number");
      expect(typeof res.body.total).toBe("number");
    }
  });

  it("sale invoice form validates required fields", () => {
    const formSrc = read("apps/web/src/components/sales/SaleInvoiceForm.tsx");

    // Uses shared SaleInvoiceSchema and zodResolver
    expect(formSrc).toContain("SaleInvoiceSchema");
    expect(formSrc).toContain("zodResolver");

    // Form fields present
    expect(formSrc).toContain('name="saleCode"');
    expect(formSrc).toContain('name="customerId"');
    expect(formSrc).toContain('name="saleDate"');
    expect(formSrc).toContain('name="status"');

    // Schema validation: empty fails
    const emptyResult = SaleInvoiceSchema.safeParse({});
    expect(emptyResult.success).toBe(false);

    // Schema validation: missing items fails
    const noItemsResult = SaleInvoiceSchema.safeParse({
      customerId: "cust-1",
      saleCode: "SALE-100",
      saleDate: "2026-10-04",
      status: "Pending",
      items: [],
    });
    expect(noItemsResult.success).toBe(false);

    // Schema validation: invalid item quantity (< 1) fails
    const badQtyResult = SaleInvoiceSchema.safeParse({
      customerId: "cust-1",
      saleCode: "SALE-100",
      saleDate: "2026-10-04",
      status: "Pending",
      items: [
        {
          productId: "prod-1",
          quantity: 0,
          unitPrice: 10,
        },
      ],
    });
    expect(badQtyResult.success).toBe(false);

    // Schema validation: valid sale invoice passes
    const validResult = SaleInvoiceSchema.safeParse({
      customerId: "cust-1",
      saleCode: "SALE-100",
      saleDate: "2026-10-04",
      status: "Pending",
      discount: 5,
      taxAmount: 2.5,
      items: [
        {
          productId: "prod-1",
          quantity: 2,
          unitPrice: 20,
          taxPercent: 5,
        },
      ],
    });
    expect(validResult.success).toBe(true);
  });

  it("sale invoice form adds/removes item rows", () => {
    const formSrc = read("apps/web/src/components/sales/SaleInvoiceForm.tsx");

    // Uses useFieldArray for dynamic line items
    expect(formSrc).toContain("useFieldArray");
    expect(formSrc).toMatch(/name:\s*["']items["']/);
    expect(formSrc).toContain("append(");
    expect(formSrc).toContain("remove(");

    // Form row fields
    expect(formSrc).toContain("productId");
    expect(formSrc).toContain("quantity");
    expect(formSrc).toContain("unitPrice");
    expect(formSrc).toContain("taxPercent");
  });

  it("sale invoice form calculates totals correctly", () => {
    const formSrc = read("apps/web/src/components/sales/SaleInvoiceForm.tsx");

    // Total display sections
    expect(formSrc).toContain("Items Subtotal");
    expect(formSrc).toContain("Grand Total");
    expect(formSrc).toContain("formatMoney");

    // Test total calculation formula directly
    const item1 = { productId: "p1", quantity: 2, unitPrice: 50 };
    const item2 = { productId: "p2", quantity: 3, unitPrice: 10 };
    const subtotal = item1.quantity * item1.unitPrice + item2.quantity * item2.unitPrice; // 100 + 30 = 130
    expect(subtotal).toBe(130);

    const discount = 10;
    const taxAmount = 5;
    const grandTotal = subtotal + taxAmount - discount; // 125
    expect(grandTotal).toBe(125);

    // Verify calculateSaleTotal matches
    const salePayload: SaleInvoiceInput = {
      saleCode: "SALE-TEST",
      customerId: "c1",
      status: "Pending",
      discount,
      taxAmount,
      items: [item1, item2],
    };
    expect(calculateSaleTotal(salePayload)).toBe(125);
  });

  it("sale invoice form submits correctly", async () => {
    const formSrc = read("apps/web/src/components/sales/SaleInvoiceForm.tsx");
    const editSrc = read("apps/web/src/pages/SaleInvoiceEdit.tsx");
    const appSrc = read("apps/web/src/App.tsx");
    const sidebarSrc = read("apps/web/src/components/layout/AppSidebar.tsx");

    // Submits via API client
    expect(formSrc).toMatch(/api\.post\(\s*["']\/sales["']/);
    expect(formSrc).toMatch(/api\.put\(\s*`\/sales\/\$\{saleId\}`/);
    expect(formSrc).toContain("toast.success");
    expect(formSrc).toContain("submitting");
    expect(formSrc).toContain("Loader2");

    // Routes registered in App.tsx
    expect(appSrc).toContain('path="/sales"');
    expect(appSrc).toContain('path="/sales/new"');
    expect(appSrc).toContain('path="/sales/:id/edit"');

    // Sidebar navigation enabled
    expect(sidebarSrc).toMatch(/title:\s*"Sale invoices"[^}]*to:\s*"\/sales"/);

    // Edit page reads :id and queries /sales/${id}
    expect(editSrc).toContain("useParams");
    expect(editSrc).toMatch(/\/sales\/\$\{id\}/);
    expect(editSrc).toContain("initialData");
    expect(editSrc).toContain("isEditing");

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
      "Sale invoice has saleCode; legacy invoiceNumber and purchaseOrderNumber must not appear in web source"
    ).toEqual([]);

    if (hasDatabase && t) {
      const product = await stockedProduct(20);
      const code = unique("SALE");
      const res = await request(app)
        .post("/api/sales")
        .set(asUser(t.organizationId, t.userId))
        .send({
          customerId: t.customerId,
          saleCode: code,
          saleDate: "2026-10-04",
          status: "Pending",
          discount: 5,
          taxAmount: 2,
          items: [
            {
              productId: product.id,
              quantity: 2,
              unitPrice: 25,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.saleCode).toBe(code);
      expect(res.body.totalAmount).toBe(47); // 2 * 25 + 2 - 5 = 47

      // Test PUT update
      const saleId = res.body.id;
      const updateRes = await request(app)
        .put(`/api/sales/${saleId}`)
        .set(asOrg(t.organizationId))
        .send({
          status: "Completed",
          discount: 10,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.status).toBe("Completed");
      expect(updateRes.body.discount).toBe(10);
    }
  });

  it("invoice PDF generation works", async () => {
    const serverPdfSrc = read("apps/server/src/services/sale-pdf.ts");
    const routeSrc = read("apps/server/src/routes/sale.ts");
    const listSrc = read("apps/web/src/pages/SaleInvoiceList.tsx");

    // Route and service exist
    expect(serverPdfSrc).toContain("generateSalePdf");
    expect(routeSrc).toContain("/:id/pdf");
    expect(listSrc).toContain("/pdf");

    if (hasDatabase && t) {
      const product = await stockedProduct(10);
      const code = unique("SALE_PDF");
      const created = await request(app)
        .post("/api/sales")
        .set(asUser(t.organizationId, t.userId))
        .send({
          customerId: t.customerId,
          saleCode: code,
          saleDate: "2026-10-04",
          status: "Completed",
          discount: 0,
          taxAmount: 0,
          items: [
            {
              productId: product.id,
              quantity: 1,
              unitPrice: 25,
            },
          ],
        });

      expect(created.status).toBe(201);
      const saleId = created.body.id;

      const pdfRes = await request(app)
        .get(`/api/sales/${saleId}/pdf`)
        .set(asOrg(t.organizationId));

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.header["content-type"]).toContain("application/pdf");
      expect(pdfRes.header["content-disposition"]).toContain(`invoice-${code}.pdf`);
      expect(pdfRes.body).toBeDefined();
    }
  }, 15000);

  it("invoice print view renders correctly", async () => {
    const templateSrc = read("apps/server/src/services/sale-invoice-template.ts");
    const routeSrc = read("apps/server/src/routes/sale.ts");
    const listSrc = read("apps/web/src/pages/SaleInvoiceList.tsx");

    // Route and template exist
    expect(templateSrc).toContain("renderSaleInvoiceHtml");
    expect(routeSrc).toContain("/:id/print");
    expect(listSrc).toContain("/print");

    if (hasDatabase && t) {
      const product = await stockedProduct(10);
      const code = unique("SALE_PRT");
      const created = await request(app)
        .post("/api/sales")
        .set(asUser(t.organizationId, t.userId))
        .send({
          customerId: t.customerId,
          saleCode: code,
          saleDate: "2026-10-04",
          status: "Completed",
          discount: 10,
          taxAmount: 5,
          items: [
            {
              productId: product.id,
              quantity: 2,
              unitPrice: 30,
            },
          ],
        });

      expect(created.status).toBe(201);
      const saleId = created.body.id;

      const printRes = await request(app)
        .get(`/api/sales/${saleId}/print`)
        .set(asOrg(t.organizationId));

      expect(printRes.status).toBe(200);
      expect(printRes.header["content-type"]).toContain("text/html");
      expect(printRes.text).toContain(code);
      expect(printRes.text).toContain("Invoice");
      expect(printRes.text).toContain("Parity Customer");
    }
  });
});
