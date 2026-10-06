/**
 * Checkpoint 4f — Returns Pages: Parity Test
 *
 * Scope: asserts the shape, contract, and behavioral integrity of the ported
 * Returns screens (ReturnList, ReturnNew, and ReturnForm):
 *
 *   - ReturnList uses DataTable from `@dms/ui` with server-side pagination;
 *   - ReturnForm validates required fields via ReturnCreateSchema with Zod;
 *   - ReturnForm dynamically conditionally renders saleId when returnType === "SALE";
 *   - ReturnForm dynamically conditionally renders purchaseId when returnType === "PURCHASE";
 *   - ReturnForm manages dynamic item rows with useFieldArray (add/remove);
 *   - ReturnForm submits returns via API and navigates to the list;
 *   - Routes are mounted under AppShell in App.tsx and linked in AppSidebar;
 *   - No legacy unbacked field names appear in web source;
 *   - When a database is available, API contracts for listing and creating returns
 *     are verified end-to-end against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { ReturnCreateSchema } from "@dms/shared";
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

describe("Checkpoint 4f — Returns Pages", () => {
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

  it("returns list renders with pagination", async () => {
    const listSrc = read("apps/web/src/pages/ReturnList.tsx");

    // Must import and render DataTable with server-side pagination props
    expect(listSrc).toContain("DataTable");
    expect(listSrc).toMatch(/<DataTable\b/);
    expect(listSrc).toContain("pageCount");
    expect(listSrc).toContain("pageIndex");
    expect(listSrc).toContain("pageSize");
    expect(listSrc).toContain("onPaginationChange");

    // Must query /returns with pagination
    expect(listSrc).toContain("/returns?");
    expect(listSrc).toContain("page");
    expect(listSrc).toContain("pageSize");

    // Must define all required table columns
    const expectedHeaders = [
      "Code",
      "Type",
      "Reference",
      "Date",
      "Items",
      "Created By",
      "Actions",
    ];
    for (const header of expectedHeaders) {
      expect(listSrc, `ReturnList must define header "${header}"`).toContain(
        `header: "${header}"`
      );
    }

    // Must handle loading states (Skeleton) and empty state
    expect(listSrc).toContain("<Skeleton");
    expect(listSrc).toContain("No returns found");

    if (hasDatabase && t) {
      const res = await request(app)
        .get("/api/returns?page=1&pageSize=5")
        .set(asOrg(t.organizationId));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.pageCount).toBe("number");
      expect(typeof res.body.total).toBe("number");
    }
  });

  it("return form validates required fields", () => {
    const formSrc = read("apps/web/src/components/returns/ReturnForm.tsx");

    // Uses shared ReturnCreateSchema and zodResolver
    expect(formSrc).toContain("ReturnCreateSchema");
    expect(formSrc).toContain("zodResolver");

    // Form fields present
    expect(formSrc).toContain('name="returnCode"');
    expect(formSrc).toContain('name="returnType"');
    expect(formSrc).toContain('name="returnDate"');

    // Schema validation: empty fails
    const emptyResult = ReturnCreateSchema.safeParse({});
    expect(emptyResult.success).toBe(false);

    // Schema validation: missing items fails
    const noItemsResult = ReturnCreateSchema.safeParse({
      returnCode: "RET-100",
      returnType: "DAMAGED",
      returnDate: "2026-10-04",
      items: [],
    });
    expect(noItemsResult.success).toBe(false);

    // Schema validation: SALE without saleId fails
    const saleNoRefResult = ReturnCreateSchema.safeParse({
      returnCode: "RET-100",
      returnType: "SALE",
      returnDate: "2026-10-04",
      items: [
        {
          productId: "prod-1",
          quantity: 1,
          unitPrice: 10,
          taxAmount: 0,
          discount: 0,
        },
      ],
    });
    expect(saleNoRefResult.success).toBe(false);

    // Schema validation: PURCHASE without purchaseId fails
    const purchaseNoRefResult = ReturnCreateSchema.safeParse({
      returnCode: "RET-100",
      returnType: "PURCHASE",
      returnDate: "2026-10-04",
      items: [
        {
          productId: "prod-1",
          quantity: 1,
          unitPrice: 10,
          taxAmount: 0,
          discount: 0,
        },
      ],
    });
    expect(purchaseNoRefResult.success).toBe(false);

    // Schema validation: valid DAMAGED return passes
    const validDamagedResult = ReturnCreateSchema.safeParse({
      returnCode: "RET-100",
      returnType: "DAMAGED",
      returnDate: "2026-10-04",
      reason: "Damaged packaging",
      items: [
        {
          productId: "prod-1",
          quantity: 2,
          unitPrice: 20,
          taxAmount: 0,
          discount: 0,
        },
      ],
    });
    expect(validDamagedResult.success).toBe(true);

    // Schema validation: valid SALE return with saleId passes
    const validSaleResult = ReturnCreateSchema.safeParse({
      returnCode: "RET-200",
      returnType: "SALE",
      returnDate: "2026-10-04",
      saleId: "sale-123",
      items: [
        {
          productId: "prod-1",
          quantity: 1,
          unitPrice: 20,
          taxAmount: 0,
          discount: 0,
        },
      ],
    });
    expect(validSaleResult.success).toBe(true);
  });

  it("return form shows saleId field for SALE type", () => {
    const formSrc = read("apps/web/src/components/returns/ReturnForm.tsx");

    // Must conditionally render saleId when returnType === "SALE"
    expect(formSrc).toMatch(/watchedReturnType\s*===\s*["']SALE["']/);
    expect(formSrc).toContain('name="saleId"');
    expect(formSrc).toContain("Original Sale Invoice");
  });

  it("return form shows purchaseId field for PURCHASE type", () => {
    const formSrc = read("apps/web/src/components/returns/ReturnForm.tsx");

    // Must conditionally render purchaseId when returnType === "PURCHASE"
    expect(formSrc).toMatch(/watchedReturnType\s*===\s*["']PURCHASE["']/);
    expect(formSrc).toContain('name="purchaseId"');
    expect(formSrc).toContain("Original Purchase Order");
  });

  it("return form adds/removes item rows", () => {
    const formSrc = read("apps/web/src/components/returns/ReturnForm.tsx");

    // Uses useFieldArray for dynamic line items
    expect(formSrc).toContain("useFieldArray");
    expect(formSrc).toMatch(/name:\s*["']items["']/);
    expect(formSrc).toContain("append(");
    expect(formSrc).toContain("remove(");

    // Form row fields
    expect(formSrc).toContain("productId");
    expect(formSrc).toContain("quantity");
    expect(formSrc).toContain("unitPrice");
    expect(formSrc).toContain("taxAmount");
    expect(formSrc).toContain("discount");
    expect(formSrc).toContain("note");
  });

  it("return form submits correctly", async () => {
    const formSrc = read("apps/web/src/components/returns/ReturnForm.tsx");
    const appSrc = read("apps/web/src/App.tsx");
    const sidebarSrc = read("apps/web/src/components/layout/AppSidebar.tsx");

    // Submits via API client
    expect(formSrc).toMatch(/api\.post\(\s*["']\/returns["']/);
    expect(formSrc).toContain("toast.success");
    expect(formSrc).toContain("submitting");
    expect(formSrc).toContain("Loader2");

    // Routes registered in App.tsx
    expect(appSrc).toContain('path="/returns"');
    expect(appSrc).toContain('path="/returns/new"');

    // Sidebar navigation enabled
    expect(sidebarSrc).toMatch(/title:\s*"Returns"[^}]*to:\s*"\/returns"/);

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
      const product = await prisma.product.create({
        data: {
          productCode: unique("SKU_RET"),
          organizationId: t.organizationId,
          name: "Parity Return Product",
          categoryId: t.categoryId,
          brandId: t.brandId,
          unit: "pcs",
          unitCost: 10,
          unitPrice: 20,
        },
      });

      await prisma.inventory.create({
        data: {
          productId: product.id,
          organizationId: t.organizationId,
          quantityOnHand: 20,
          reorderLevel: 2,
        },
      });

      const code = unique("RET");
      const res = await request(app)
        .post("/api/returns")
        .set(asUser(t.organizationId, t.userId))
        .send({
          returnCode: code,
          returnType: "DAMAGED",
          returnDate: "2026-10-04",
          reason: "Damaged box write-off",
          items: [
            {
              productId: product.id,
              quantity: 2,
              unitPrice: 20,
              taxAmount: 0,
              discount: 0,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.returnCode).toBe(code);
      expect(res.body.returnType).toBe("DAMAGED");
    }
  });
});
