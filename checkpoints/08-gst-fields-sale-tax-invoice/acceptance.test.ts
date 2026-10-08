/**
 * Checkpoint 8 — GST Fields + Sale Tax Invoice: Acceptance Test
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { ProductSchema, SaleInvoiceSchema, calculateSaleBreakdown } from "@dms/shared";
import { createSale } from "../../apps/server/src/services/sale";
import { renderSaleInvoiceHtml } from "../../apps/server/src/services/sale-invoice-template";
import { hasDatabase, prisma, unique } from "../support/parity-db";

const root = path.resolve(__dirname, "../..");

describe("Checkpoint 8 — GST Fields", () => {
  it("product form saves gstApplicable and gstRate", () => {
    // 1. ProductSchema validates gstApplicable and gstRate fields
    const parsed = ProductSchema.parse({
      name: "GST Test Product",
      productCode: "GST-PROD-01",
      category: "cat-1",
      brand: "brand-1",
      unit: "pcs",
      unitCost: "100.00",
      unitPrice: "150.00",
      gstApplicable: true,
      gstRate: 18,
    });

    expect(parsed.gstApplicable).toBe(true);
    expect(parsed.gstRate).toBe(18);

    // 2. ProductForm component file exists and contains GST inputs
    const formPath = path.join(root, "apps/web/src/components/products/ProductForm.tsx");
    expect(fs.existsSync(formPath)).toBe(true);
    const formCode = fs.readFileSync(formPath, "utf-8");
    expect(formCode).toContain("gstApplicable");
    expect(formCode).toContain("gstRate");
    expect(formCode).toContain("GST Applicable");
    expect(formCode).toContain("GST Rate (%)");
  });

  it("sale invoice calculates CGST/SGST for intra-state", async () => {
    const calculation = calculateSaleBreakdown({
      items: [
        {
          productId: "prod-1",
          productCode: "P01",
          productName: "Intra Product",
          quantity: 2,
          unitPrice: 100,
          subtotal: 200,
          gstRate: 18,
          gstApplicable: true,
        },
      ],
      isInterState: false,
    });

    expect(calculation.subtotal).toBe(200);
    expect(calculation.cgstAmount).toBe(18); // 9% of 200
    expect(calculation.sgstAmount).toBe(18); // 9% of 200
    expect(calculation.igstAmount).toBe(0);
    expect(calculation.taxAmount).toBe(36);
    expect(calculation.total).toBe(236);

    const item = calculation.items[0];
    expect(item.cgstRate).toBe(9);
    expect(item.sgstRate).toBe(9);
    expect(item.igstRate).toBe(0);
    expect(item.cgstAmount).toBe(18);
    expect(item.sgstAmount).toBe(18);
    expect(item.igstAmount).toBe(0);
  });

  it("sale invoice calculates IGST for inter-state", async () => {
    const calculation = calculateSaleBreakdown({
      items: [
        {
          productId: "prod-2",
          productCode: "P02",
          productName: "Inter Product",
          quantity: 2,
          unitPrice: 100,
          subtotal: 200,
          gstRate: 18,
          gstApplicable: true,
        },
      ],
      isInterState: true,
    });

    expect(calculation.subtotal).toBe(200);
    expect(calculation.cgstAmount).toBe(0);
    expect(calculation.sgstAmount).toBe(0);
    expect(calculation.igstAmount).toBe(36); // 18% of 200
    expect(calculation.taxAmount).toBe(36);
    expect(calculation.total).toBe(236);

    const item = calculation.items[0];
    expect(item.cgstRate).toBe(0);
    expect(item.sgstRate).toBe(0);
    expect(item.igstRate).toBe(18);
    expect(item.cgstAmount).toBe(0);
    expect(item.sgstAmount).toBe(0);
    expect(item.igstAmount).toBe(36);
  });

  it("invoice template shows GST breakdown", () => {
    const html = renderSaleInvoiceHtml({
      saleCode: "SALE-GST-001",
      saleDate: new Date(),
      status: "Completed",
      invoiceType: "tax",
      isInterState: false,
      cgstAmount: 18,
      sgstAmount: 18,
      igstAmount: 0,
      taxAmount: 36,
      totalAmount: 236,
      customer: { name: "Test Customer" },
      items: [
        {
          quantity: 2,
          unitPrice: 100,
          totalPrice: 200,
          cgstRate: 9,
          sgstRate: 9,
          igstRate: 0,
          cgstAmount: 18,
          sgstAmount: 18,
          product: {
            name: "Taxed Widget",
            productCode: "TW-1",
            gstApplicable: true,
            gstRate: 18,
          },
        },
      ],
    });

    expect(html).toContain("Tax Invoice");
    expect(html).toContain("CGST");
    expect(html).toContain("SGST");
    expect(html).toContain("GST: 18%");
    expect(html).toContain("18.00");
  });

  it("tax invoice type shows Tax Invoice header", () => {
    const taxHtml = renderSaleInvoiceHtml({
      saleCode: "SALE-TAX-001",
      saleDate: new Date(),
      status: "Completed",
      invoiceType: "tax",
      totalAmount: 100,
    });

    expect(taxHtml).toContain("Tax Invoice");
    expect(taxHtml).toContain("Official GST Tax Invoice");

    const regularHtml = renderSaleInvoiceHtml({
      saleCode: "SALE-REG-001",
      saleDate: new Date(),
      status: "Completed",
      invoiceType: "regular",
      totalAmount: 100,
    });

    expect(regularHtml).toContain("Regular Invoice");
    expect(regularHtml).not.toContain("Official GST Tax Invoice");
  });

  it("GST amounts are stored on Sale and SaleItem", async () => {
    // 1. SaleInvoiceSchema parses GST fields
    const parsed = SaleInvoiceSchema.parse({
      saleCode: "SALE-001",
      customerId: "cust-1",
      status: "Completed",
      invoiceType: "tax",
      isInterState: false,
      cgstAmount: 9,
      sgstAmount: 9,
      taxAmount: 18,
      items: [
        {
          productId: "prod-1",
          quantity: 1,
          unitPrice: 100,
          subtotal: 100,
          cgstRate: 9,
          sgstRate: 9,
          igstRate: 0,
          cgstAmount: 9,
          sgstAmount: 9,
          igstAmount: 0,
        },
      ],
    });

    expect(parsed.invoiceType).toBe("tax");
    expect(parsed.isInterState).toBe(false);
    expect(parsed.cgstAmount).toBe(9);
    expect(parsed.sgstAmount).toBe(9);

    // 2. Integration verification when database is connected
    if (!hasDatabase) return;

    const orgId = unique("org");
    const userId = unique("usr");
    const at = new Date();

    await prisma.organization.create({
      data: { id: orgId, name: `Org ${orgId}`, createdAt: at },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        name: "Tester",
        emailVerified: true,
        createdAt: at,
        updatedAt: at,
      },
    });

    const cat = await prisma.category.create({
      data: { name: "GST Cat", organizationId: orgId },
    });

    const brand = await prisma.brand.create({
      data: { name: "GST Brand", organizationId: orgId, categoryId: cat.id },
    });

    const cust = await prisma.customer.create({
      data: { name: "GST Customer", organizationId: orgId, customerCode: unique("CUST") },
    });

    const prod = await prisma.product.create({
      data: {
        organizationId: orgId,
        name: "GST Db Product",
        productCode: unique("GST-P"),
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
        quantityOnHand: 20,
        quantityReserved: 0,
      },
    });

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
            quantity: 2,
            unitPrice: 100,
            subtotal: 200,
          },
        ],
      },
      orgId,
      userId
    );

    const reloaded = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: { items: true },
    });

    expect(reloaded).not.toBeNull();
    expect(reloaded?.invoiceType).toBe("tax");
    expect(reloaded?.isInterState).toBe(false);
    expect(reloaded?.totalAmount).toBe(236);
    expect(reloaded?.cgstAmount).toBe(18);
    expect(reloaded?.sgstAmount).toBe(18);
    expect(reloaded?.igstAmount).toBe(0);
    expect(reloaded?.taxAmount).toBe(36);

    const line = reloaded?.items[0];
    expect(line?.cgstRate).toBe(9);
    expect(line?.sgstRate).toBe(9);
    expect(line?.cgstAmount).toBe(18);
    expect(line?.sgstAmount).toBe(18);
  });
});
