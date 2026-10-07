/**
 * Checkpoint 10 — Bulk Import: Acceptance Test
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../apps/server/src/app";
import {
  parseInventoryCSV,
  validateInventoryRow,
  transformRowToInventoryInput,
  generateInventoryCSVTemplate,
  CSV_TEMPLATE_HEADERS,
} from "../../apps/web/src/lib/csv";
import {
  InventoryCreateSchema,
  inventoryBulkImportRowSchema,
  inventoryBulkImportSchema,
} from "@dms/shared";
import { bulkImportInventory } from "../../apps/server/src/services/inventory";

// Mock database for service/route assertions
const mockFindManyProducts = vi.fn();
const mockFindManyInventory = vi.fn();
const mockFindFirstInventory = vi.fn();
const mockCreateInventory = vi.fn();
const mockUpdateInventory = vi.fn();
const mockTransaction = vi.fn(async (cb: any) =>
  cb({
    inventory: {
      findFirst: mockFindFirstInventory,
      create: mockCreateInventory,
      update: mockUpdateInventory,
    },
    product: {
      findMany: mockFindManyProducts,
    },
  })
);

vi.mock("@dms/db", () => ({
  default: {
    product: {
      findMany: (...args: any[]) => mockFindManyProducts(...args),
      findFirst: vi.fn(),
    },
    inventory: {
      findFirst: (...args: any[]) => mockFindFirstInventory(...args),
      create: (...args: any[]) => mockCreateInventory(...args),
      update: (...args: any[]) => mockUpdateInventory(...args),
      findMany: (...args: any[]) => mockFindManyInventory(...args),
      count: vi.fn().mockResolvedValue(0),
    },
    inventoryLog: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: (cb: any) => mockTransaction(cb),
  },
  prisma: {
    product: {
      findMany: (...args: any[]) => mockFindManyProducts(...args),
      findFirst: vi.fn(),
    },
    inventory: {
      findFirst: (...args: any[]) => mockFindFirstInventory(...args),
      create: (...args: any[]) => mockCreateInventory(...args),
      update: (...args: any[]) => mockUpdateInventory(...args),
      findMany: (...args: any[]) => mockFindManyInventory(...args),
      count: vi.fn().mockResolvedValue(0),
    },
    inventoryLog: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: (cb: any) => mockTransaction(cb),
  },
}));

describe("Checkpoint 10 — Bulk Import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("CSV file parses correctly with papaparse", async () => {
    const csvContent = [
      "productCode,productName,quantityOnHand,reorderLevel,maxStockLevel",
      "PROD-001,Widget Alpha,100,20,500",
      "PROD-002,Gadget Beta,50,10,200",
    ].join("\n");

    const rows = await parseInventoryCSV(csvContent);
    expect(rows).toHaveLength(2);
    expect(rows[0].productCode).toBe("PROD-001");
    expect(rows[0].productName).toBe("Widget Alpha");
    expect(rows[0].quantityOnHand).toBe("100");
    expect(rows[0].reorderLevel).toBe("20");
    expect(rows[0].maxStockLevel).toBe("500");

    expect(rows[1].productCode).toBe("PROD-002");
    expect(rows[1].quantityOnHand).toBe("50");
  });

  it("valid rows are imported successfully", async () => {
    mockFindManyProducts.mockResolvedValue([
      { id: "p1", productCode: "PROD-001", name: "Widget Alpha" },
      { id: "p2", productCode: "PROD-002", name: "Gadget Beta" },
    ]);
    mockFindFirstInventory.mockResolvedValue(null);
    mockCreateInventory.mockResolvedValue({ id: "inv_1" });

    const rows = [
      { productCode: "PROD-001", quantityOnHand: 100, reorderLevel: 20 },
      { productCode: "PROD-002", quantityOnHand: 50, reorderLevel: 10 },
    ];

    const result = await bulkImportInventory(rows, "org_test");
    expect(result.success).toBe(2);
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateInventory).toHaveBeenCalledTimes(2);
  });

  it("invalid rows show error messages", async () => {
    // 1. Validation utility testing
    const invalidRow = {
      productCode: "",
      quantityOnHand: -10,
      reorderLevel: "invalid",
      maxStockLevel: 5,
    };
    const validation = validateInventoryRow(invalidRow);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors).toContain("Product Code is required");
    expect(validation.errors).toContain("Quantity On Hand cannot be negative");

    // 2. Service level error capture for missing product
    mockFindManyProducts.mockResolvedValue([
      { id: "p1", productCode: "VALID-001", name: "Valid Product" },
    ]);
    mockFindFirstInventory.mockResolvedValue(null);
    mockCreateInventory.mockResolvedValue({ id: "inv_1" });

    const mixedRows = [
      { productCode: "VALID-001", quantityOnHand: 25 },
      { productCode: "MISSING-002", quantityOnHand: 10 },
    ];

    const result = await bulkImportInventory(mixedRows, "org_test");
    expect(result.success).toBe(1);
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(2);
    expect(result.errors[0].productCode).toBe("MISSING-002");
    expect(result.errors[0].error).toContain("not found");
  });

  it("preview table shows parsed data", async () => {
    const csvContent = "code,name,qty,minStock\nP-100,Test Item,75,15\n";
    const rows = await parseInventoryCSV(csvContent);
    expect(rows).toHaveLength(1);

    const validation = validateInventoryRow(rows[0]);
    expect(validation.valid).toBe(true);

    const transformed = transformRowToInventoryInput(rows[0]);
    expect(transformed.productCode).toBe("P-100");
    expect(transformed.productName).toBe("Test Item");
    expect(transformed.quantityOnHand).toBe(75);
    expect(transformed.reorderLevel).toBe(15);
  });

  it("bulk import endpoint handles large files", async () => {
    const app = createApp();

    // Create 150 rows
    const mockProducts = Array.from({ length: 150 }, (_, i) => ({
      id: `p_${i + 1}`,
      productCode: `BULK-${String(i + 1).padStart(4, "0")}`,
      name: `Bulk Product ${i + 1}`,
    }));
    mockFindManyProducts.mockResolvedValue(mockProducts);
    mockFindFirstInventory.mockResolvedValue(null);
    mockCreateInventory.mockResolvedValue({ id: "inv_created" });

    const importRows = mockProducts.map((p) => ({
      productCode: p.productCode,
      quantityOnHand: 25,
      reorderLevel: 5,
    }));

    const res = await request(app)
      .post("/api/inventory/bulk-import")
      .set({ "x-organization-id": "org_large_test", "x-user-id": "user_1" })
      .send({ rows: importRows });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(150);
    expect(res.body.created).toBe(150);
    expect(res.body.errors).toHaveLength(0);
  });

  it("form fields match the real schema", () => {
    // InventoryCreateSchema requires productId and quantityOnHand >= 0
    const validSingle = {
      productId: "prod_123",
      quantityOnHand: 10,
      reorderLevel: 5,
      maxStockLevel: 50,
      quantityReserved: 0,
    };
    expect(InventoryCreateSchema.safeParse(validSingle).success).toBe(true);

    // Negative stock rejected by real schema
    const invalidSingle = {
      productId: "prod_123",
      quantityOnHand: -5,
    };
    expect(InventoryCreateSchema.safeParse(invalidSingle).success).toBe(false);

    // inventoryBulkImportRowSchema requires productCode and non-negative quantityOnHand
    const validImportRow = {
      productCode: "SKU-99",
      productName: "Sample",
      quantityOnHand: 15,
      reorderLevel: 2,
    };
    expect(inventoryBulkImportRowSchema.safeParse(validImportRow).success).toBe(true);

    const invalidImportRow = {
      productCode: "",
      quantityOnHand: "not-a-number",
    };
    expect(inventoryBulkImportRowSchema.safeParse(invalidImportRow).success).toBe(false);

    // inventoryBulkImportSchema requires at least 1 row
    expect(inventoryBulkImportSchema.safeParse({ rows: [] }).success).toBe(false);
  });

  it("CSV template downloads correctly", async () => {
    const template = generateInventoryCSVTemplate();
    expect(template).toContain("productCode,productName,quantityOnHand,reorderLevel,maxStockLevel");
    expect(template).toContain("PROD-001");
    expect(template).toContain("PROD-002");

    // Verify the generated template is parseable and valid
    const parsed = await parseInventoryCSV(template);
    expect(parsed.length).toBeGreaterThanOrEqual(2);

    for (const row of parsed) {
      const val = validateInventoryRow(row);
      expect(val.valid).toBe(true);
      expect(val.errors).toHaveLength(0);
    }
  });
});
