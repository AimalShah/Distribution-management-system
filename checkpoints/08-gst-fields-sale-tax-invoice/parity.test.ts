/**
 * Checkpoint 8 — GST Fields + Sale Tax Invoice: Parity Test
 *
 * Scope:
 * 1. Schema assertions: Product GST fields, Sale invoiceType & GST fields, SaleItem tax rate & amount columns.
 * 2. Shared validation schemas: ProductSchema, SaleInvoiceSchema, SaleInvoiceItemSchema, SaleUpdateSchema.
 * 3. Service calculation logic: Intra-state (CGST/SGST) vs Inter-state (IGST) split and totals.
 * 4. Express API route: GET /api/sales/:id/invoice endpoint returns invoice breakdown.
 * 5. Invoice documents: HTML template, React invoice skeleton, and the server-side PDF adapter.
 * 6. Web UI forms: ProductForm and SaleInvoiceForm GST integration.
 * 7. Live DB tests (when database is available): End-to-end creation and persistence of tax invoices.
 */
import { describe, expect, it, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import {
  calculateSaleBreakdown,
  ProductSchema,
  SaleInvoiceSchema,
  SaleInvoiceItemSchema,
  SaleUpdateSchema,
} from "@dms/shared";
import { createApp } from "../../apps/server/src/app";
import { createSale } from "../../apps/server/src/services/sale";
import { renderSaleInvoiceHtml } from "../../apps/server/src/services/sale-invoice-template";
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

describe("Checkpoint 8 — GST Fields & Tax Invoice (Contract & Static)", () => {
  it("declares Product, Sale, and SaleItem GST fields in Prisma schema", () => {
    const schema = read("packages/db/prisma/schema.prisma");

    // Product model
    expect(schema).toMatch(/model Product\s*\{[\s\S]*?gstApplicable\s+Boolean\s+@default\(true\)[\s\S]*?\}/);
    expect(schema).toMatch(/model Product\s*\{[\s\S]*?gstRate\s+Float\s+@default\(0\)[\s\S]*?\}/);

    // Sale model
    expect(schema).toMatch(/model Sale\s*\{[\s\S]*?invoiceType\s+String\s+@default\("regular"\)[\s\S]*?\}/);
    expect(schema).toMatch(/model Sale\s*\{[\s\S]*?isInterState\s+Boolean\s+@default\(false\)[\s\S]*?\}/);
    expect(schema).toMatch(/model Sale\s*\{[\s\S]*?cgstAmount\s+Float\s+@default\(0\)[\s\S]*?\}/);
    expect(schema).toMatch(/model Sale\s*\{[\s\S]*?sgstAmount\s+Float\s+@default\(0\)[\s\S]*?\}/);
    expect(schema).toMatch(/model Sale\s*\{[\s\S]*?igstAmount\s+Float\s+@default\(0\)[\s\S]*?\}/);

    // SaleItem model
    expect(schema).toMatch(/model SaleItem\s*\{[\s\S]*?cgstRate\s+Float\s+@default\(0\)[\s\S]*?\}/);
    expect(schema).toMatch(/model SaleItem\s*\{[\s\S]*?sgstRate\s+Float\s+@default\(0\)[\s\S]*?\}/);
    expect(schema).toMatch(/model SaleItem\s*\{[\s\S]*?igstRate\s+Float\s+@default\(0\)[\s\S]*?\}/);
    expect(schema).toMatch(/model SaleItem\s*\{[\s\S]*?cgstAmount\s+Float\s+@default\(0\)[\s\S]*?\}/);
    expect(schema).toMatch(/model SaleItem\s*\{[\s\S]*?sgstAmount\s+Float\s+@default\(0\)[\s\S]*?\}/);
    expect(schema).toMatch(/model SaleItem\s*\{[\s\S]*?igstAmount\s+Float\s+@default\(0\)[\s\S]*?\}/);
  });

  it("shared validation schemas parse and validate GST fields", () => {
    // ProductSchema
    const productParsed = ProductSchema.parse({
      name: "Widget Pro",
      productCode: "WGT-001",
      category: "cat-1",
      brand: "brand-1",
      unit: "pcs",
      unitCost: 50,
      unitPrice: 100,
      gstApplicable: true,
      gstRate: 18,
    });

    expect(productParsed.gstApplicable).toBe(true);
    expect(productParsed.gstRate).toBe(18);

    // SaleInvoiceItemSchema
    const itemParsed = SaleInvoiceItemSchema.parse({
      productId: "prod-1",
      quantity: 5,
      unitPrice: 200,
      subtotal: 1000,
      cgstRate: 9,
      sgstRate: 9,
      igstRate: 0,
      cgstAmount: 90,
      sgstAmount: 90,
      igstAmount: 0,
    });

    expect(itemParsed.cgstRate).toBe(9);
    expect(itemParsed.sgstRate).toBe(9);
    expect(itemParsed.cgstAmount).toBe(90);
    expect(itemParsed.sgstAmount).toBe(90);

    // SaleInvoiceSchema
    const saleParsed = SaleInvoiceSchema.parse({
      saleCode: "SALE-001",
      customerId: "cust-1",
      status: "Completed",
      invoiceType: "tax",
      isInterState: true,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 180,
      taxAmount: 180,
      items: [itemParsed],
    });

    expect(saleParsed.invoiceType).toBe("tax");
    expect(saleParsed.isInterState).toBe(true);
    expect(saleParsed.igstAmount).toBe(180);

    // SaleUpdateSchema does not inject default values when fields are absent
    const updateParsed = SaleUpdateSchema.parse({
      status: "Completed",
    });

    expect(updateParsed.invoiceType).toBeUndefined();
    expect(updateParsed.isInterState).toBeUndefined();
  });

  it("calculates intra-state GST with 50/50 CGST and SGST split", () => {
    const res = calculateSaleBreakdown({
      items: [
        {
          productId: "prod-1",
          quantity: 10,
          unitPrice: 50,
          subtotal: 500,
          gstApplicable: true,
          gstRate: 12,
        },
      ],
      isInterState: false,
    });

    expect(res.subtotal).toBe(500);
    expect(res.cgstAmount).toBe(30); // 6% of 500
    expect(res.sgstAmount).toBe(30); // 6% of 500
    expect(res.igstAmount).toBe(0);
    expect(res.taxAmount).toBe(60);
    expect(res.total).toBe(560);

    expect(res.items[0].cgstRate).toBe(6);
    expect(res.items[0].sgstRate).toBe(6);
    expect(res.items[0].igstRate).toBe(0);
    expect(res.items[0].cgstAmount).toBe(30);
    expect(res.items[0].sgstAmount).toBe(30);
    expect(res.items[0].igstAmount).toBe(0);
  });

  it("calculates inter-state GST with 100% IGST", () => {
    const res = calculateSaleBreakdown({
      items: [
        {
          productId: "prod-2",
          quantity: 10,
          unitPrice: 50,
          subtotal: 500,
          gstApplicable: true,
          gstRate: 12,
        },
      ],
      isInterState: true,
    });

    expect(res.subtotal).toBe(500);
    expect(res.cgstAmount).toBe(0);
    expect(res.sgstAmount).toBe(0);
    expect(res.igstAmount).toBe(60); // 12% of 500
    expect(res.taxAmount).toBe(60);
    expect(res.total).toBe(560);

    expect(res.items[0].cgstRate).toBe(0);
    expect(res.items[0].sgstRate).toBe(0);
    expect(res.items[0].igstRate).toBe(12);
    expect(res.items[0].cgstAmount).toBe(0);
    expect(res.items[0].sgstAmount).toBe(0);
    expect(res.items[0].igstAmount).toBe(60);
  });

  it("handles non-applicable or 0% GST items without adding tax", () => {
    const res = calculateSaleBreakdown({
      items: [
        {
          productId: "prod-exempt",
          quantity: 5,
          unitPrice: 100,
          subtotal: 500,
          gstApplicable: false,
          gstRate: 18,
        },
        {
          productId: "prod-zero",
          quantity: 2,
          unitPrice: 200,
          subtotal: 400,
          gstApplicable: true,
          gstRate: 0,
        },
      ],
      isInterState: false,
    });

    expect(res.subtotal).toBe(900);
    expect(res.cgstAmount).toBe(0);
    expect(res.sgstAmount).toBe(0);
    expect(res.igstAmount).toBe(0);
    expect(res.taxAmount).toBe(0);
    expect(res.total).toBe(900);
  });

  it("express routes register GET /:id/invoice endpoint", () => {
    const routeCode = read("apps/server/src/routes/sale.ts");
    expect(routeCode).toMatch(/saleRouter\.get\(\s*["']\/:id\/invoice["']/);
    expect(routeCode).toContain("getSaleInvoiceData");
  });

  it("sale invoice template renders tax breakdown and tax invoice title", () => {
    const templateCode = read("apps/server/src/services/sale-invoice-template.ts");
    expect(templateCode).toContain("isTaxInvoice");
    expect(templateCode).toContain("cgstAmount");
    expect(templateCode).toContain("sgstAmount");
    expect(templateCode).toContain("igstAmount");

    const html = renderSaleInvoiceHtml({
      saleCode: "SALE-TEST-99",
      saleDate: "2026-10-07",
      status: "Completed",
      invoiceType: "tax",
      isInterState: true,
      igstAmount: 54,
      totalAmount: 354,
      items: [
        {
          quantity: 3,
          unitPrice: 100,
          igstRate: 18,
          igstAmount: 54,
          product: { name: "Pro Widget", gstRate: 18 },
        },
      ],
    });

    expect(html).toContain("Tax Invoice");
    expect(html).toContain("IGST");
    expect(html).toContain("54.00");
  });

  it("saleInvoiceSkeleton component includes GST breakdown and Tax Invoice header", () => {
    const skeletonCode = read("src/components/invoices/saleInvoiceSkeleton.tsx");
    expect(skeletonCode).toContain("isTaxInvoice");
    expect(skeletonCode).toContain("cgstAmount");
    expect(skeletonCode).toContain("sgstAmount");
    expect(skeletonCode).toContain("igstAmount");
    expect(skeletonCode).toContain("Tax Invoice");
  });

  it("invoice PDF is rendered by the server adapter, not the browser", () => {
    expect(fs.existsSync(path.join(root, "apps/web/src/utils/generateInvoicePdf.ts"))).toBe(false);

    const pdfCode = read("apps/server/src/services/sale-pdf.ts");
    expect(pdfCode).toContain("generateSalePdf");
    expect(pdfCode).toContain("renderSaleInvoiceHtml");

    const pdfRouteCode = read("apps/server/src/routes/sale.ts");
    expect(pdfRouteCode).toMatch(/saleRouter\.get\(\s*["']\/:id\/pdf["']/);
  });

  it("ProductForm and SaleInvoiceForm provide GST UI inputs", () => {
    const prodForm = read("apps/web/src/components/products/ProductForm.tsx");
    expect(prodForm).toContain("gstApplicable");
    expect(prodForm).toContain("gstRate");

    const saleForm = read("apps/web/src/components/sales/SaleInvoiceForm.tsx");
    expect(saleForm).toContain("invoiceType");
    expect(saleForm).toContain("isInterState");
    expect(saleForm).toContain("CGST");
    expect(saleForm).toContain("SGST");
    expect(saleForm).toContain("IGST");
  });
});

describe("Checkpoint 8 — GST Fields (Live DB & API)", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp({ authMode: "header" });
  });

  it("persists GST amounts and exposes GET /api/sales/:id/invoice", async () => {
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
      data: { name: "Cat GST", organizationId: orgId },
    });

    const brand = await prisma.brand.create({
      data: { name: "Brand GST", organizationId: orgId },
    });

    const cust = await prisma.customer.create({
      data: { name: "Customer GST", organizationId: orgId },
    });

    const prod = await prisma.product.create({
      data: {
        organizationId: orgId,
        name: "Taxed Item",
        productCode: unique("TI"),
        unit: "pcs",
        unitCost: 50,
        unitPrice: 100,
        categoryId: cat.id,
        brandId: brand.id,
        gstApplicable: true,
        gstRate: 18,
      },
    });

    await prisma.inventory.create({
      data: {
        organizationId: orgId,
        productId: prod.id,
        quantityOnHand: 50,
        quantityReserved: 0,
      },
    });

    // 1. Create intra-state tax sale
    const sale = await createSale(
      {
        saleCode: unique("S"),
        customerId: cust.id,
        status: "Completed",
        invoiceType: "tax",
        isInterState: false,
        items: [
          {
            productId: prod.id,
            quantity: 4,
            unitPrice: 100,
            subtotal: 400,
          },
        ],
      },
      orgId,
      userId
    );

    expect(sale.invoiceType).toBe("tax");
    expect(sale.isInterState).toBe(false);
    expect(sale.cgstAmount).toBe(36);
    expect(sale.sgstAmount).toBe(36);
    expect(sale.igstAmount).toBe(0);
    expect(sale.taxAmount).toBe(72);
    expect(sale.totalAmount).toBe(472);

    // 2. Fetch invoice via API endpoint
    const res = await request(app)
      .get(`/api/sales/${sale.id}/invoice`)
      .set(ORGANIZATION_HEADER, orgId)
      .set(USER_HEADER, userId);

    expect(res.status).toBe(200);
    expect(res.body.saleCode).toBe(sale.saleCode);
    expect(res.body.invoiceType).toBe("tax");
    expect(res.body.isInterState).toBe(false);
    expect(res.body.cgstAmount).toBe(36);
    expect(res.body.sgstAmount).toBe(36);
    expect(res.body.igstAmount).toBe(0);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].cgstRate).toBe(9);
    expect(res.body.items[0].sgstRate).toBe(9);
    expect(res.body.items[0].cgstAmount).toBe(36);
    expect(res.body.items[0].sgstAmount).toBe(36);
  });
});
