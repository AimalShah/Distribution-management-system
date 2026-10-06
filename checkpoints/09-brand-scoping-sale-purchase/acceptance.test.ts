/**
 * Checkpoint 9 — Brand-Scoping: Acceptance Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import { createApp } from "../../apps/server/src/app";
import {
  getSalesByBrand,
  getSalesByProduct,
} from "../../apps/server/src/services/reports/sales-report";
import {
  getPurchaseByBrand,
  getPurchaseByProduct,
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

describe("Checkpoint 9 — Brand-Scoping", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp({ authMode: "header" });
  });

  it("sales report can be filtered by brand", async () => {
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
      data: { name: "Cat 1", organizationId: orgId },
    });
    const brandA = await prisma.brand.create({
      data: { name: "Brand Alpha", organizationId: orgId },
    });
    const brandB = await prisma.brand.create({
      data: { name: "Brand Beta", organizationId: orgId },
    });
    const cust = await prisma.customer.create({
      data: { name: "Customer 1", organizationId: orgId },
    });

    const prodA = await prisma.product.create({
      data: {
        organizationId: orgId,
        name: "Product Alpha",
        productCode: unique("PA"),
        unit: "pcs",
        unitCost: 10,
        unitPrice: 20,
        categoryId: cat.id,
        brandId: brandA.id,
      },
    });

    const prodB = await prisma.product.create({
      data: {
        organizationId: orgId,
        name: "Product Beta",
        productCode: unique("PB"),
        unit: "pcs",
        unitCost: 15,
        unitPrice: 30,
        categoryId: cat.id,
        brandId: brandB.id,
      },
    });

    await prisma.inventory.createMany({
      data: [
        { organizationId: orgId, productId: prodA.id, quantityOnHand: 50, quantityReserved: 0 },
        { organizationId: orgId, productId: prodB.id, quantityOnHand: 50, quantityReserved: 0 },
      ],
    });

    await createSale(
      {
        saleCode: unique("SA"),
        customerId: cust.id,
        status: "Completed",
        items: [
          { productId: prodA.id, quantity: 3, unitPrice: 20, subtotal: 60 },
          { productId: prodB.id, quantity: 2, unitPrice: 30, subtotal: 60 },
        ],
      },
      orgId,
      userId
    );

    // Filter by Brand Alpha
    const filteredA = await getSalesByProduct(orgId, { brandId: brandA.id });
    expect(filteredA.some((p) => p.productId === prodA.id)).toBe(true);
    expect(filteredA.some((p) => p.productId === prodB.id)).toBe(false);

    // Filter by Brand Beta
    const filteredB = await getSalesByProduct(orgId, { brandId: brandB.id });
    expect(filteredB.some((p) => p.productId === prodB.id)).toBe(true);
    expect(filteredB.some((p) => p.productId === prodA.id)).toBe(false);

    // Over HTTP
    const res = await request(app)
      .get(`/api/reports/sales/by-product?brandId=${brandA.id}`)
      .set(ORGANIZATION_HEADER, orgId)
      .set(USER_HEADER, userId);

    expect(res.status).toBe(200);
    expect(res.body.some((p: any) => p.productId === prodA.id)).toBe(true);
    expect(res.body.some((p: any) => p.productId === prodB.id)).toBe(false);
  });

  it("purchase report can be filtered by brand", async () => {
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
      data: { name: "Cat P", organizationId: orgId },
    });
    const brandA = await prisma.brand.create({
      data: { name: "Brand Purchase A", organizationId: orgId },
    });
    const brandB = await prisma.brand.create({
      data: { name: "Brand Purchase B", organizationId: orgId },
    });
    const supplier = await prisma.supplier.create({
      data: {
        organizationId: orgId,
        companyName: "Supplier X",
        contactPerson: "Bob",
        email: `${unique("supp")}@test.com`,
        phone: "555-1234",
        address: "123 Street",
      },
    });

    const prodA = await prisma.product.create({
      data: {
        organizationId: orgId,
        name: "Purchase Item A",
        productCode: unique("PPA"),
        unit: "pcs",
        unitCost: 10,
        unitPrice: 20,
        categoryId: cat.id,
        brandId: brandA.id,
      },
    });

    const prodB = await prisma.product.create({
      data: {
        organizationId: orgId,
        name: "Purchase Item B",
        productCode: unique("PPB"),
        unit: "pcs",
        unitCost: 15,
        unitPrice: 30,
        categoryId: cat.id,
        brandId: brandB.id,
      },
    });

    await prisma.inventory.createMany({
      data: [
        { organizationId: orgId, productId: prodA.id, quantityOnHand: 0, quantityReserved: 0 },
        { organizationId: orgId, productId: prodB.id, quantityOnHand: 0, quantityReserved: 0 },
      ],
    });

    await createPurchase(
      {
        purchaseCode: unique("PO"),
        supplierId: supplier.id,
        status: "Completed",
        items: [
          { productId: prodA.id, quantity: 5, unitCost: 10, totalCost: 50 },
          { productId: prodB.id, quantity: 4, unitCost: 15, totalCost: 60 },
        ],
      },
      orgId,
      userId
    );

    // Filter by Brand A
    const filteredA = await getPurchaseByProduct(orgId, { brandId: brandA.id });
    expect(filteredA.some((p) => p.productId === prodA.id)).toBe(true);
    expect(filteredA.some((p) => p.productId === prodB.id)).toBe(false);

    // Over HTTP
    const res = await request(app)
      .get(`/api/reports/purchase/by-product?brandId=${brandA.id}`)
      .set(ORGANIZATION_HEADER, orgId)
      .set(USER_HEADER, userId);

    expect(res.status).toBe(200);
    expect(res.body.some((p: any) => p.productId === prodA.id)).toBe(true);
    expect(res.body.some((p: any) => p.productId === prodB.id)).toBe(false);
  });

  it("sales by brand report shows correct grouping", async () => {
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
      data: { name: "Cat G", organizationId: orgId },
    });
    const brandX = await prisma.brand.create({
      data: { name: "Brand X", organizationId: orgId },
    });
    const cust = await prisma.customer.create({
      data: { name: "Customer X", organizationId: orgId },
    });

    const prodX = await prisma.product.create({
      data: {
        organizationId: orgId,
        name: "Item X",
        productCode: unique("IX"),
        unit: "pcs",
        unitCost: 10,
        unitPrice: 25,
        categoryId: cat.id,
        brandId: brandX.id,
      },
    });

    await prisma.inventory.create({
      data: { organizationId: orgId, productId: prodX.id, quantityOnHand: 50, quantityReserved: 0 },
    });

    await createSale(
      {
        saleCode: unique("SX"),
        customerId: cust.id,
        status: "Completed",
        items: [{ productId: prodX.id, quantity: 4, unitPrice: 25, subtotal: 100 }],
      },
      orgId,
      userId
    );

    const report = await getSalesByBrand(orgId, {});
    const brandEntry = report.find((b) => b.brandId === brandX.id);

    expect(brandEntry).toBeDefined();
    expect(brandEntry?.brandName).toBe("Brand X");
    expect(brandEntry?.quantity).toBe(4);
    expect(brandEntry?.totalAmount).toBe(100);

    // Over HTTP
    const res = await request(app)
      .get("/api/reports/sales/by-brand")
      .set(ORGANIZATION_HEADER, orgId)
      .set(USER_HEADER, userId);

    expect(res.status).toBe(200);
    const entry = res.body.find((b: any) => b.brandId === brandX.id);
    expect(entry).toBeDefined();
    expect(entry.quantity).toBe(4);
    expect(entry.totalAmount).toBe(100);
  });

  it("purchase by brand report shows correct grouping", async () => {
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
      data: { name: "Cat PB", organizationId: orgId },
    });
    const brandY = await prisma.brand.create({
      data: { name: "Brand Y", organizationId: orgId },
    });
    const supplier = await prisma.supplier.create({
      data: {
        organizationId: orgId,
        companyName: "Supplier Y",
        contactPerson: "Alice",
        email: `${unique("suppY")}@test.com`,
        phone: "555-9876",
        address: "456 Avenue",
      },
    });

    const prodY = await prisma.product.create({
      data: {
        organizationId: orgId,
        name: "Item Y",
        productCode: unique("IY"),
        unit: "pcs",
        unitCost: 40,
        unitPrice: 80,
        categoryId: cat.id,
        brandId: brandY.id,
      },
    });

    await prisma.inventory.create({
      data: { organizationId: orgId, productId: prodY.id, quantityOnHand: 0, quantityReserved: 0 },
    });

    await createPurchase(
      {
        purchaseCode: unique("PY"),
        supplierId: supplier.id,
        status: "Completed",
        items: [{ productId: prodY.id, quantity: 3, unitCost: 40, totalCost: 120 }],
      },
      orgId,
      userId
    );

    const report = await getPurchaseByBrand(orgId, {});
    const brandEntry = report.find((b) => b.brandId === brandY.id);

    expect(brandEntry).toBeDefined();
    expect(brandEntry?.brandName).toBe("Brand Y");
    expect(brandEntry?.quantity).toBe(3);
    expect(brandEntry?.totalCost).toBe(120);

    // Over HTTP
    const res = await request(app)
      .get("/api/reports/purchase/by-brand")
      .set(ORGANIZATION_HEADER, orgId)
      .set(USER_HEADER, userId);

    expect(res.status).toBe(200);
    const entry = res.body.find((b: any) => b.brandId === brandY.id);
    expect(entry).toBeDefined();
    expect(entry.quantity).toBe(3);
    expect(entry.totalCost).toBe(120);
  });

  it("brand filter dropdown renders in reports page", () => {
    const pagePath = path.join(root, "apps/web/src/pages/ReportsPage.tsx");
    expect(fs.existsSync(pagePath)).toBe(true);

    const pageCode = fs.readFileSync(pagePath, "utf-8");
    expect(pageCode).toContain("brandId");
    expect(pageCode).toContain("selectedBrandId");
    expect(pageCode).toContain("All Brands");
    expect(pageCode).toContain("Brand Report");
    expect(pageCode).toContain("BrandReportTab");
  });
});
