/**
 * Checkpoint 9 — Brand-Scoping on Sale/Purchase: Parity Test
 *
 * Scope:
 * 1. Schema assertions: reportRangeQuerySchema, salesByBrandQuerySchema, purchaseByBrandQuerySchema.
 * 2. Service contracts: getSalesByBrand, getPurchaseByBrand, brand-filtered getSalesByProduct/getPurchaseByProduct.
 * 3. Express API routes: GET /api/reports/sales/by-brand, GET /api/reports/purchase/by-brand.
 * 4. Web UI components: Brand filter select, Brand Report tab, BrandReportTab component.
 * 5. Live DB tests (when database is available): End-to-end brand-scoped sales/purchases aggregation and reporting.
 */
import { describe, expect, it, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import {
  reportRangeQuerySchema,
  salesByBrandQuerySchema,
  purchaseByBrandQuerySchema,
  salesByProductQuerySchema,
  purchaseByProductQuerySchema,
} from "@dms/shared";
import { createApp } from "../../apps/server/src/app";
import {
  getSalesByBrand,
  getSalesByProduct,
  getFullSalesReport,
} from "../../apps/server/src/services/reports/sales-report";
import {
  getPurchaseByBrand,
  getPurchaseByProduct,
  getFullPurchaseReport,
} from "../../apps/server/src/services/reports/purchase-report";
import { createSale } from "../../apps/server/src/services/sale";
import { createPurchase } from "../../apps/server/src/services/purchase";
import {
  hasDatabase,
  prisma,
  unique,
  ORGANIZATION_HEADER,
  USER_HEADER,
} from "../support/parity-db";

const root = path.resolve(__dirname, "../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);
  return fs.readFileSync(full, "utf-8");
};

describe("Checkpoint 9 — Brand-Scoping (Contract & Static)", () => {
  it("shared validation schemas accept brandId and define by-brand schemas", () => {
    // 1. reportRangeQuerySchema accepts brandId
    const rangeResult = reportRangeQuerySchema.safeParse({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      brandId: "brand_abc_123",
    });
    expect(rangeResult.success).toBe(true);
    if (rangeResult.success) {
      expect(rangeResult.data.brandId).toBe("brand_abc_123");
    }

    // 2. salesByProductQuerySchema & purchaseByProductQuerySchema accept brandId
    expect(salesByProductQuerySchema.safeParse({ brandId: "b1" }).success).toBe(true);
    expect(purchaseByProductQuerySchema.safeParse({ brandId: "b1" }).success).toBe(true);

    // 3. by-brand schemas exist and accept date range + brandId
    expect(salesByBrandQuerySchema.safeParse({ brandId: "b1" }).success).toBe(true);
    expect(purchaseByBrandQuerySchema.safeParse({ brandId: "b1" }).success).toBe(true);
  });

  it("express routers mount /by-brand endpoints for sales and purchase reports", () => {
    const salesRoutes = read("apps/server/src/routes/reports/sales.ts");
    expect(salesRoutes).toMatch(/salesReportRouter\.get\(\s*["']\/by-brand["']/);
    expect(salesRoutes).toContain("getSalesByBrand");

    const purchaseRoutes = read("apps/server/src/routes/reports/purchase.ts");
    expect(purchaseRoutes).toMatch(/purchaseReportRouter\.get\(\s*["']\/by-brand["']/);
    expect(purchaseRoutes).toContain("getPurchaseByBrand");
  });

  it("services export getSalesByBrand and getPurchaseByBrand functions", () => {
    const salesService = read("apps/server/src/services/reports/sales-report.ts");
    expect(salesService).toContain("export async function getSalesByBrand");
    expect(salesService).toContain("byBrand");

    const purchaseService = read("apps/server/src/services/reports/purchase-report.ts");
    expect(purchaseService).toContain("export async function getPurchaseByBrand");
    expect(purchaseService).toContain("byBrand");
  });

  it("web client includes brand selector and Brand Report tab in ReportsPage", () => {
    const pageCode = read("apps/web/src/pages/ReportsPage.tsx");
    expect(pageCode).toContain("brandId");
    expect(pageCode).toContain("selectedBrandId");
    expect(pageCode).toContain("All Brands");
    expect(pageCode).toContain("Brand Report");
    expect(pageCode).toContain("brandReport");
    expect(pageCode).toContain("BrandReportTab");

    const tabCode = read("apps/web/src/components/reports/BrandReportTab.tsx");
    expect(tabCode).toContain("/reports/sales/by-brand");
    expect(tabCode).toContain("/reports/purchase/by-brand");
    expect(tabCode).toContain("Sales by Brand");
    expect(tabCode).toContain("Purchases by Brand");
  });
});

describe("Checkpoint 9 — Brand-Scoping (Live DB & API)", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp({ authMode: "header" });
  });

  it("rejects unauthenticated requests to /by-brand without organization header", async () => {
    const salesRes = await request(app).get("/api/reports/sales/by-brand");
    expect(salesRes.status).toBe(400);

    const purchaseRes = await request(app).get("/api/reports/purchase/by-brand");
    expect(purchaseRes.status).toBe(400);
  });

  it("filters sales by brand and reports brand groupings end-to-end", async () => {
    if (!hasDatabase) return;

    const orgId = unique("org");
    const userId = unique("usr");

    await prisma.organization.create({
      data: { id: orgId, name: `Org ${orgId}`, code: orgId },
    });
    await prisma.user.create({
      data: { id: userId, email: `${userId}@test.com`, name: "Tester" },
    });
    const cat = await prisma.category.create({
      data: { name: "Electronics", organizationId: orgId },
    });
    const brand1 = await prisma.brand.create({
      data: { name: "Sony", organizationId: orgId },
    });
    const brand2 = await prisma.brand.create({
      data: { name: "Samsung", organizationId: orgId },
    });
    const cust = await prisma.customer.create({
      data: { name: "Tech Store", organizationId: orgId },
    });
    const supp = await prisma.supplier.create({
      data: {
        organizationId: orgId,
        companyName: "Global Wholesale",
        contactPerson: "Dave",
        email: `${unique("supp")}@gw.com`,
        phone: "555-0011",
        address: "777 Market St",
      },
    });

    const prod1 = await prisma.product.create({
      data: {
        organizationId: orgId,
        name: "Headphones",
        productCode: unique("SN-HP"),
        unit: "pcs",
        unitCost: 50,
        unitPrice: 100,
        categoryId: cat.id,
        brandId: brand1.id,
      },
    });

    const prod2 = await prisma.product.create({
      data: {
        organizationId: orgId,
        name: "TV Monitor",
        productCode: unique("SM-TV"),
        unit: "pcs",
        unitCost: 150,
        unitPrice: 300,
        categoryId: cat.id,
        brandId: brand2.id,
      },
    });

    await prisma.inventory.createMany({
      data: [
        { organizationId: orgId, productId: prod1.id, quantityOnHand: 20, quantityReserved: 0 },
        { organizationId: orgId, productId: prod2.id, quantityOnHand: 10, quantityReserved: 0 },
      ],
    });

    // 1. Create Sale spanning both brands
    await createSale(
      {
        saleCode: unique("SL-MULTI"),
        customerId: cust.id,
        status: "Completed",
        items: [
          { productId: prod1.id, quantity: 2, unitPrice: 100, subtotal: 200 },
          { productId: prod2.id, quantity: 1, unitPrice: 300, subtotal: 300 },
        ],
      },
      orgId,
      userId
    );

    // 2. Create Purchase spanning both brands
    await createPurchase(
      {
        purchaseCode: unique("PO-MULTI"),
        supplierId: supp.id,
        status: "Completed",
        items: [
          { productId: prod1.id, quantity: 10, unitCost: 50, totalCost: 500 },
          { productId: prod2.id, quantity: 5, unitCost: 150, totalCost: 750 },
        ],
      },
      orgId,
      userId
    );

    // 3. Test Brand-Filtered Sales
    const sonySales = await getSalesByProduct(orgId, { brandId: brand1.id });
    expect(sonySales).toHaveLength(1);
    expect(sonySales[0].productId).toBe(prod1.id);
    expect(sonySales[0].quantity).toBe(2);
    expect(sonySales[0].totalPrice).toBe(200);

    const samsungSales = await getSalesByProduct(orgId, { brandId: brand2.id });
    expect(samsungSales).toHaveLength(1);
    expect(samsungSales[0].productId).toBe(prod2.id);
    expect(samsungSales[0].quantity).toBe(1);
    expect(samsungSales[0].totalPrice).toBe(300);

    // 4. Test Sales by Brand Grouping
    const brandSales = await getSalesByBrand(orgId, {});
    expect(brandSales.length).toBeGreaterThanOrEqual(2);
    const b1Sales = brandSales.find((b) => b.brandId === brand1.id);
    const b2Sales = brandSales.find((b) => b.brandId === brand2.id);
    expect(b1Sales).toBeDefined();
    expect(b1Sales?.brandName).toBe("Sony");
    expect(b1Sales?.quantity).toBe(2);
    expect(b1Sales?.totalAmount).toBe(200);

    expect(b2Sales).toBeDefined();
    expect(b2Sales?.brandName).toBe("Samsung");
    expect(b2Sales?.quantity).toBe(1);
    expect(b2Sales?.totalAmount).toBe(300);

    // 5. Test Purchases by Brand Grouping
    const brandPurchases = await getPurchaseByBrand(orgId, {});
    const b1Purch = brandPurchases.find((b) => b.brandId === brand1.id);
    const b2Purch = brandPurchases.find((b) => b.brandId === brand2.id);
    expect(b1Purch).toBeDefined();
    expect(b1Purch?.brandName).toBe("Sony");
    expect(b1Purch?.quantity).toBe(10);
    expect(b1Purch?.totalCost).toBe(500);

    expect(b2Purch).toBeDefined();
    expect(b2Purch?.brandName).toBe("Samsung");
    expect(b2Purch?.quantity).toBe(5);
    expect(b2Purch?.totalCost).toBe(750);

    // 6. Test HTTP Endpoints
    const httpBrandSales = await request(app)
      .get("/api/reports/sales/by-brand")
      .set(ORGANIZATION_HEADER, orgId)
      .set(USER_HEADER, userId);
    expect(httpBrandSales.status).toBe(200);
    expect(httpBrandSales.body.some((b: any) => b.brandId === brand1.id)).toBe(true);

    const httpBrandPurch = await request(app)
      .get("/api/reports/purchase/by-brand")
      .set(ORGANIZATION_HEADER, orgId)
      .set(USER_HEADER, userId);
    expect(httpBrandPurch.status).toBe(200);
    expect(httpBrandPurch.body.some((b: any) => b.brandId === brand2.id)).toBe(true);

    // 7. Test Full Reports Include byBrand
    const fullSales = await getFullSalesReport(orgId, {});
    expect(fullSales).toHaveProperty("byBrand");
    expect((fullSales as any).byBrand.some((b: any) => b.brandId === brand1.id)).toBe(true);

    const fullPurch = await getFullPurchaseReport(orgId, {});
    expect(fullPurch).toHaveProperty("byBrand");
    expect((fullPurch as any).byBrand.some((b: any) => b.brandId === brand2.id)).toBe(true);
  });
});
