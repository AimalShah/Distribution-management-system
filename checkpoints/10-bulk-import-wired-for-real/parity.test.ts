/**
 * Checkpoint 10 — Bulk Import, Wired for Real: Parity Test
 *
 * Scope:
 * 1. Schema assertions: inventoryBulkImportRowSchema, inventoryBulkImportSchema, InventoryCreateSchema.
 * 2. CSV parsing and validation contracts: parseInventoryCSV, validateInventoryRow, transformRowToInventoryInput, generateInventoryCSVTemplate.
 * 3. Express API route: POST /api/inventory/bulk-import with authorization and payload handling.
 * 4. UI components: AddInventoryForm with tabs, manual form, CSV file selection, preview table, and template download.
 * 5. Live DB tests (when database is available): End-to-end bulk import with real transaction upserts and error tracking.
 */
import { describe, expect, it, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import {
  InventoryCreateSchema,
  inventoryBulkImportRowSchema,
  inventoryBulkImportSchema,
} from "@dms/shared";
import { createApp } from "../../apps/server/src/app";
import {
  parseInventoryCSV,
  validateInventoryRow,
  transformRowToInventoryInput,
  generateInventoryCSVTemplate,
} from "../../apps/web/src/lib/csv";
import { bulkImportInventory } from "../../apps/server/src/services/inventory";
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

describe("Checkpoint 10 — Bulk Import (Contract & Static)", () => {
  it("shared validation schemas define bulk import schemas and align with real models", () => {
    // 1. Single row validation
    const validRow = {
      productCode: "PROD-101",
      productName: "Alpha Widget",
      quantityOnHand: 40,
      reorderLevel: 5,
      maxStockLevel: 100,
    };
    const rowParsed = inventoryBulkImportRowSchema.safeParse(validRow);
    expect(rowParsed.success).toBe(true);

    // Negative stock should fail
    const invalidRow = {
      productCode: "PROD-102",
      quantityOnHand: -5,
    };
    expect(inventoryBulkImportRowSchema.safeParse(invalidRow).success).toBe(false);

    // Empty product code should fail
    expect(
      inventoryBulkImportRowSchema.safeParse({ productCode: "", quantityOnHand: 10 }).success
    ).toBe(false);

    // 2. Bulk envelope schema requires at least 1 row
    expect(inventoryBulkImportSchema.safeParse({ rows: [] }).success).toBe(false);
    expect(inventoryBulkImportSchema.safeParse({ rows: [validRow] }).success).toBe(true);

    // 3. Manual entry schema
    expect(
      InventoryCreateSchema.safeParse({
        productId: "prod_xyz",
        quantityOnHand: 20,
      }).success
    ).toBe(true);
  });

  it("csv library exposes real parsing, validation, transformation and template utilities", () => {
    const csvSrc = read("apps/web/src/lib/csv.ts");
    expect(csvSrc).toContain("export async function parseInventoryCSV");
    expect(csvSrc).toContain("export function validateInventoryRow");
    expect(csvSrc).toContain("export function transformRowToInventoryInput");
    expect(csvSrc).toContain("export function generateInventoryCSVTemplate");
    expect(csvSrc).toContain("export function downloadInventoryCSVTemplate");
    expect(csvSrc).toContain('from "papaparse"');
  });

  it("AddInventoryForm component implements manual entry, template download, and real CSV import", () => {
    const formSrc = read("apps/web/src/components/inventory/AddInventoryForm.tsx");
    expect(formSrc).toContain("AddInventoryForm");
    expect(formSrc).toContain("Single Product Entry");
    expect(formSrc).toContain("Bulk CSV Import");
    expect(formSrc).toContain("Download Template");
    expect(formSrc).toContain("parseInventoryCSV");
    expect(formSrc).toContain("validateInventoryRow");
    expect(formSrc).toContain("/inventory/bulk-import");
    expect(formSrc).toContain("csv-preview-table");
  });

  it("AddInventoryDialog embeds AddInventoryForm", () => {
    const dialogSrc = read("apps/web/src/components/inventory/AddInventoryDialog.tsx");
    expect(dialogSrc).toContain("AddInventoryForm");
  });

  it("server routes and services expose POST /api/inventory/bulk-import", () => {
    const routesSrc = read("apps/server/src/routes/inventory.ts");
    expect(routesSrc).toContain('"/bulk-import"');
    expect(routesSrc).toContain("bulkImportInventory");

    const serviceSrc = read("apps/server/src/services/inventory.ts");
    expect(serviceSrc).toContain("export async function bulkImportInventory");
    expect(serviceSrc).toContain("$transaction");
  });
});

describe("Checkpoint 10 — CSV Parsing & Validation Functionality", () => {
  it("parses valid CSV string into structured rows and handles column normalization", async () => {
    const csvContent = [
      "itemCode,name,quantity,minStock,maxLevel",
      "SKU-001,Premium Bottle,150,25,300",
      "SKU-002,Standard Cup,80,10,120",
    ].join("\n");

    const rows = await parseInventoryCSV(csvContent);
    expect(rows).toHaveLength(2);
    expect(rows[0].productCode).toBe("SKU-001");
    expect(rows[0].productName).toBe("Premium Bottle");
    expect(rows[0].quantityOnHand).toBe("150");
    expect(rows[0].reorderLevel).toBe("25");
    expect(rows[0].maxStockLevel).toBe("300");
  });

  it("validates row data correctly and produces descriptive error messages", () => {
    // Valid
    const valid = validateInventoryRow({
      productCode: "TEST-1",
      quantityOnHand: "50",
      reorderLevel: "10",
      maxStockLevel: "100",
    });
    expect(valid.valid).toBe(true);
    expect(valid.errors).toHaveLength(0);

    // Invalid: missing code and negative stock
    const invalid = validateInventoryRow({
      productCode: "",
      quantityOnHand: "-20",
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toContain("Product Code is required");
    expect(invalid.errors).toContain("Quantity On Hand cannot be negative");

    // Invalid: max level less than reorder
    const invalidLevels = validateInventoryRow({
      productCode: "TEST-2",
      quantityOnHand: "10",
      reorderLevel: "50",
      maxStockLevel: "20",
    });
    expect(invalidLevels.valid).toBe(false);
    expect(invalidLevels.errors).toContain(
      "Maximum Stock Level should not be less than Reorder Level"
    );
  });

  it("transforms parsed row into clean input for the bulk import payload", () => {
    const transformed = transformRowToInventoryInput({
      productCode: "  SKU-999  ",
      productName: "  Test Product  ",
      quantityOnHand: "75",
      reorderLevel: "12",
      maxStockLevel: "250",
    });

    expect(transformed).toEqual({
      productCode: "SKU-999",
      productName: "Test Product",
      quantityOnHand: 75,
      reorderLevel: 12,
      maxStockLevel: 250,
    });
  });

  it("generates a well-formed CSV template", async () => {
    const template = generateInventoryCSVTemplate();
    expect(template.startsWith("productCode,productName,quantityOnHand,reorderLevel,maxStockLevel")).toBe(true);

    const parsed = await parseInventoryCSV(template);
    expect(parsed.length).toBeGreaterThan(0);
    for (const row of parsed) {
      expect(validateInventoryRow(row).valid).toBe(true);
    }
  });
});

describe("Checkpoint 10 — Express API Endpoints", () => {
  const proxyApp = createApp({ authMode: "trusted-proxy" });
  const defaultApp = createApp();

  it("POST /api/inventory/bulk-import rejects unauthenticated calls in session mode", async () => {
    const res = await request(defaultApp)
      .post("/api/inventory/bulk-import")
      .send({ rows: [{ productCode: "P-1", quantityOnHand: 10 }] });

    expect(res.status).toBe(401);
  });

  it("POST /api/inventory/bulk-import rejects calls missing organization header in proxy mode", async () => {
    const res = await request(proxyApp)
      .post("/api/inventory/bulk-import")
      .send({ rows: [{ productCode: "P-1", quantityOnHand: 10 }] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
  });

  it("POST /api/inventory/bulk-import rejects invalid payload when authenticated", async () => {
    const res = await request(proxyApp)
      .post("/api/inventory/bulk-import")
      .set({ [ORGANIZATION_HEADER]: "org_dummy" })
      .send({ invalid: true });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_BULK_IMPORT_PAYLOAD");
  });
});

describe("Checkpoint 10 — Live Database Integration", () => {
  let orgId: string;
  let userId: string;
  let categoryId: string;
  let brandId: string;
  let product1: { id: string; productCode: string };
  let product2: { id: string; productCode: string };

  beforeAll(async () => {
    if (!hasDatabase) return;

    const org = await prisma.organization.create({
      data: {
        name: `Bulk Import Org ${unique()}`,
        currency: "PKR",
      },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        id: `user_${unique()}`,
        name: "Inventory Staff",
        email: `staff_${unique()}@test.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    userId = user.id;

    const cat = await prisma.category.create({
      data: {
        name: `Bulk Category ${unique()}`,
        organizationId: orgId,
      },
    });
    categoryId = cat.id;

    const brand = await prisma.brand.create({
      data: {
        name: `Bulk Brand ${unique()}`,
        organizationId: orgId,
        categoryId: cat.id,
      },
    });
    brandId = brand.id;

    product1 = await prisma.product.create({
      data: {
        productCode: `BULK-P1-${unique()}`,
        name: "Bulk Test Item 1",
        organizationId: orgId,
        categoryId,
        brandId,
        unit: "pcs",
        unitPrice: 100,
        unitCost: 60,
      },
    });

    product2 = await prisma.product.create({
      data: {
        productCode: `BULK-P2-${unique()}`,
        name: "Bulk Test Item 2",
        organizationId: orgId,
        categoryId,
        brandId,
        unit: "box",
        unitPrice: 250,
        unitCost: 150,
      },
    });
  });

  it("imports valid rows atomically and creates inventory records", async () => {
    if (!hasDatabase) return;

    const rows = [
      {
        productCode: product1.productCode,
        quantityOnHand: 80,
        reorderLevel: 15,
        maxStockLevel: 200,
      },
      {
        productCode: product2.productCode,
        quantityOnHand: 45,
        reorderLevel: 10,
        maxStockLevel: 100,
      },
    ];

    const result = await bulkImportInventory(rows, orgId);
    expect(result.success).toBe(2);
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);

    const inv1 = await prisma.inventory.findFirst({
      where: { productId: product1.id, organizationId: orgId },
    });
    expect(inv1).not.toBeNull();
    expect(inv1?.quantityOnHand).toBe(80);
    expect(inv1?.reorderLevel).toBe(15);
    expect(inv1?.maxStockLevel).toBe(200);

    const inv2 = await prisma.inventory.findFirst({
      where: { productId: product2.id, organizationId: orgId },
    });
    expect(inv2).not.toBeNull();
    expect(inv2?.quantityOnHand).toBe(45);
  });

  it("updates existing inventory records when rows are re-imported", async () => {
    if (!hasDatabase) return;

    const rows = [
      {
        productCode: product1.productCode,
        quantityOnHand: 120, // updated from 80
        reorderLevel: 25,
      },
    ];

    const result = await bulkImportInventory(rows, orgId);
    expect(result.success).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);

    const inv = await prisma.inventory.findFirst({
      where: { productId: product1.id, organizationId: orgId },
    });
    expect(inv?.quantityOnHand).toBe(120);
    expect(inv?.reorderLevel).toBe(25);
  });

  it("reports row errors for invalid and non-existent products while importing valid ones", async () => {
    if (!hasDatabase) return;

    const rows = [
      {
        productCode: product2.productCode,
        quantityOnHand: 60,
      },
      {
        productCode: "DOES-NOT-EXIST-CODE",
        quantityOnHand: 30,
      },
    ];

    const result = await bulkImportInventory(rows, orgId);
    expect(result.success).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].productCode).toBe("DOES-NOT-EXIST-CODE");
    expect(result.errors[0].error).toContain("not found");
  });
});
