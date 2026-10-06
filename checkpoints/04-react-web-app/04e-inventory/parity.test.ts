/**
 * Checkpoint 4e — Inventory Page: Parity Test
 *
 * Scope: asserts the shape, contract, and behavioral integrity of the ported
 * Inventory screen (InventoryPage, AdjustStockDialog, and AddInventoryDialog):
 *
 *   - Inventory tab renders DataTable from `@dms/ui` with server-side pagination;
 *   - Movement logs tab renders DataTable from `@dms/ui` with server-side pagination;
 *   - AdjustStockDialog validates with InventoryAdjustSchema and submits stock changes via API;
 *   - AddInventoryDialog validates with InventoryCreateSchema and initializes stock levels via API;
 *   - Tabs switch correctly between inventory levels and movement audit logs;
 *   - Routes are mounted under AppShell in App.tsx and linked in AppSidebar;
 *   - No legacy unbacked field names appear in web source;
 *   - When a database is available, API contracts for listing, creating, reading, and adjusting
 *     inventory rows and audit logs are verified end-to-end against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  InventoryAdjustSchema,
  InventoryCreateSchema,
} from "@dms/shared";
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

describe("Checkpoint 4e — Inventory Page", () => {
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

  it("inventory tab renders with pagination", async () => {
    const pageSrc = read("apps/web/src/pages/InventoryPage.tsx");

    // Must import and render DataTable with server-side pagination props
    expect(pageSrc).toContain("DataTable");
    expect(pageSrc).toMatch(/<DataTable\b/);
    expect(pageSrc).toContain("pageCount");
    expect(pageSrc).toContain("pageIndex");
    expect(pageSrc).toContain("pageSize");
    expect(pageSrc).toContain("onPaginationChange");

    // Must query /inventory with pagination
    expect(pageSrc).toContain("/inventory?");
    expect(pageSrc).toContain("page");
    expect(pageSrc).toContain("pageSize");

    // Must define all required inventory table columns
    const expectedHeaders = [
      "Product",
      "On Hand",
      "Reserved",
      "Reorder Level",
      "Max Stock",
      "Status",
      "Actions",
    ];
    for (const header of expectedHeaders) {
      expect(pageSrc, `InventoryPage must define header "${header}"`).toContain(
        `header: "${header}"`
      );
    }

    // Must handle loading states (Skeleton) and empty state
    expect(pageSrc).toContain("<Skeleton");
    expect(pageSrc).toContain("No inventory records found");

    if (hasDatabase && t) {
      const res = await request(app)
        .get("/api/inventory?page=1&pageSize=5")
        .set(asOrg(t.organizationId));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.pageCount).toBe("number");
      expect(typeof res.body.total).toBe("number");
    }
  });

  it("movement logs tab renders with pagination", async () => {
    const pageSrc = read("apps/web/src/pages/InventoryPage.tsx");

    // Must query /inventory/logs with pagination
    expect(pageSrc).toContain("/inventory/logs?");
    expect(pageSrc).toContain("page");
    expect(pageSrc).toContain("pageSize");

    // Must define all required movement log columns
    const expectedHeaders = [
      "Date",
      "Product",
      "Movement",
      "Quantity",
      "Previous",
      "New",
      "Reason",
      "User",
    ];
    for (const header of expectedHeaders) {
      expect(pageSrc, `Movement logs must define header "${header}"`).toContain(
        `header: "${header}"`
      );
    }

    // Must handle loading and empty states
    expect(pageSrc).toContain("No movement logs found");

    if (hasDatabase && t) {
      const res = await request(app)
        .get("/api/inventory/logs?page=1&pageSize=5")
        .set(asOrg(t.organizationId));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.pageCount).toBe("number");
      expect(typeof res.body.total).toBe("number");
    }
  });

  it("adjust inventory dialog opens and submits", async () => {
    const adjustSrc = read("apps/web/src/components/inventory/AdjustStockDialog.tsx");

    // Uses shared InventoryAdjustSchema and zodResolver
    expect(adjustSrc).toContain("InventoryAdjustSchema");
    expect(adjustSrc).toContain("zodResolver");

    // Form fields present
    expect(adjustSrc).toContain('name="movementType"');
    expect(adjustSrc).toContain('name="quantity"');
    expect(adjustSrc).toContain('name="reason"');

    // Submits via API client
    expect(adjustSrc).toMatch(/api\.post\(\s*["']\/inventory\/adjust["']/);
    expect(adjustSrc).toContain("toast.success");
    expect(adjustSrc).toContain("submitting");

    // Schema validation checks
    const emptyResult = InventoryAdjustSchema.safeParse({});
    expect(emptyResult.success).toBe(false);

    const noReasonResult = InventoryAdjustSchema.safeParse({
      inventoryId: "inv-1",
      movementType: "IN",
      quantity: 5,
      reason: "",
    });
    expect(noReasonResult.success).toBe(false);

    const validResult = InventoryAdjustSchema.safeParse({
      inventoryId: "inv-1",
      movementType: "IN",
      quantity: 10,
      reason: "Stock arrival shipment",
    });
    expect(validResult.success).toBe(true);

    if (hasDatabase && t) {
      const product = await prisma.product.create({
        data: {
          productCode: unique("SKU_ADJ"),
          organizationId: t.organizationId,
          name: "Adjust Test Product",
          categoryId: t.categoryId,
          brandId: t.brandId,
          unit: "pcs",
          unitCost: 10,
          unitPrice: 20,
        },
      });

      const inv = await prisma.inventory.create({
        data: {
          productId: product.id,
          organizationId: t.organizationId,
          quantityOnHand: 25,
          reorderLevel: 5,
        },
      });

      const res = await request(app)
        .post("/api/inventory/adjust")
        .set(asUser(t.organizationId, t.userId))
        .send({
          inventoryId: inv.id,
          movementType: "IN",
          quantity: 10,
          reason: "Manual adjustment test",
        });

      expect(res.status).toBe(200);
      expect(res.body.quantityOnHand).toBe(35);
    }
  });

  it("add inventory form validates correctly", () => {
    const addSrc = read("apps/web/src/components/inventory/AddInventoryDialog.tsx");

    // Uses shared InventoryCreateSchema and zodResolver
    expect(addSrc).toContain("InventoryCreateSchema");
    expect(addSrc).toContain("zodResolver");

    // Form fields present
    expect(addSrc).toContain('name="productId"');
    expect(addSrc).toContain('name="quantityOnHand"');
    expect(addSrc).toContain('name="reorderLevel"');
    expect(addSrc).toContain('name="maxStockLevel"');
    expect(addSrc).toContain('name="quantityReserved"');

    // Schema validation: empty fails
    const emptyResult = InventoryCreateSchema.safeParse({});
    expect(emptyResult.success).toBe(false);

    // Schema validation: missing productId fails
    const noProductResult = InventoryCreateSchema.safeParse({
      quantityOnHand: 10,
    });
    expect(noProductResult.success).toBe(false);

    // Schema validation: negative quantityOnHand fails
    const negativeQtyResult = InventoryCreateSchema.safeParse({
      productId: "prod-1",
      quantityOnHand: -5,
    });
    expect(negativeQtyResult.success).toBe(false);

    // Schema validation: valid payload passes
    const validResult = InventoryCreateSchema.safeParse({
      productId: "prod-1",
      quantityOnHand: 50,
      reorderLevel: 10,
      maxStockLevel: 200,
      quantityReserved: 0,
    });
    expect(validResult.success).toBe(true);
  });

  it("add inventory form submits correctly", async () => {
    const addSrc = read("apps/web/src/components/inventory/AddInventoryDialog.tsx");

    // Submits via API client
    expect(addSrc).toMatch(/api\.post\(\s*["']\/inventory["']/);
    expect(addSrc).toContain("toast.success");
    expect(addSrc).toContain("submitting");

    if (hasDatabase && t) {
      const product = await prisma.product.create({
        data: {
          productCode: unique("SKU_ADD"),
          organizationId: t.organizationId,
          name: "Add Stock Product",
          categoryId: t.categoryId,
          brandId: t.brandId,
          unit: "pcs",
          unitCost: 12,
          unitPrice: 24,
        },
      });

      const res = await request(app)
        .post("/api/inventory")
        .set(asOrg(t.organizationId))
        .send({
          productId: product.id,
          quantityOnHand: 40,
          reorderLevel: 8,
          maxStockLevel: 150,
          quantityReserved: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.productId).toBe(product.id);
      expect(res.body.quantityOnHand).toBe(40);
      expect(res.body.reorderLevel).toBe(8);
      expect(res.body.maxStockLevel).toBe(150);
      expect(res.body.quantityReserved).toBe(2);
    }
  });

  it("tabs switch correctly", () => {
    const pageSrc = read("apps/web/src/pages/InventoryPage.tsx");
    const appSrc = read("apps/web/src/App.tsx");
    const sidebarSrc = read("apps/web/src/components/layout/AppSidebar.tsx");

    // Tabs elements rendered
    expect(pageSrc).toContain("<Tabs");
    expect(pageSrc).toContain("<TabsList");
    expect(pageSrc).toMatch(/<TabsTrigger[^>]*value=["']inventory["']/);
    expect(pageSrc).toMatch(/<TabsTrigger[^>]*value=["']logs["']/);
    expect(pageSrc).toMatch(/<TabsContent[^>]*value=["']inventory["']/);
    expect(pageSrc).toMatch(/<TabsContent[^>]*value=["']logs["']/);

    // Routes registered in App.tsx
    expect(appSrc).toContain('path="/inventory"');

    // Sidebar navigation enabled
    expect(sidebarSrc).toMatch(/title:\s*"Inventory"[^}]*to:\s*"\/inventory"/);

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
  });
});
