import Papa from "papaparse";
import type { InventoryBulkImportRow } from "@dms/shared";

export interface ParsedInventoryRow {
  productCode?: string;
  productName?: string;
  quantityOnHand?: string | number;
  reorderLevel?: string | number;
  maxStockLevel?: string | number;
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ValidatedInventoryRow {
  rowNumber: number;
  data: ParsedInventoryRow;
  transformed?: InventoryBulkImportRow;
  validation: ValidationResult;
}

/**
 * Normalizes CSV column names to standardized keys.
 */
function normalizeHeader(header: string): string {
  const clean = header.trim().toLowerCase().replace(/[\s_-]+/g, "");

  if (clean === "productcode" || clean === "code" || clean === "sku" || clean === "itemcode") {
    return "productCode";
  }

  if (clean === "productname" || clean === "name" || clean === "itemname" || clean === "description") {
    return "productName";
  }

  if (
    clean === "quantityonhand" ||
    clean === "quantity" ||
    clean === "qty" ||
    clean === "stock" ||
    clean === "onhand"
  ) {
    return "quantityOnHand";
  }

  if (clean === "reorderlevel" || clean === "minstock" || clean === "minstocklevel" || clean === "reorder") {
    return "reorderLevel";
  }

  if (clean === "maxstocklevel" || clean === "maxstock" || clean === "maxlevel" || clean === "maximumstock") {
    return "maxStockLevel";
  }

  return header.trim();
}

/**
 * Parses inventory CSV file or string content using PapaParse.
 */
export async function parseInventoryCSV(input: File | string): Promise<ParsedInventoryRow[]> {
  const text: string =
    typeof input === "string"
      ? input
      : typeof (input as any).text === "function"
        ? await (input as any).text()
        : await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(input);
          });

  return new Promise((resolve, reject) => {
    try {
      const results = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: normalizeHeader,
      });

      if (results.errors && results.errors.length > 0) {
        // If there are parsing errors and no data was parsed, reject
        if (!results.data || results.data.length === 0) {
          return reject(new Error(results.errors[0]?.message || "Failed to parse CSV"));
        }
      }

      const rows = (results.data || []).map((row) => {
        const cleanRow: ParsedInventoryRow = {};

        for (const [k, v] of Object.entries(row)) {
          cleanRow[k] = typeof v === "string" ? v.trim() : v;
        }

        return cleanRow;
      });

      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Validates a single parsed inventory row according to the business rules.
 */
export function validateInventoryRow(row: ParsedInventoryRow): ValidationResult {
  const errors: string[] = [];

  // Product Code
  if (!row.productCode || String(row.productCode).trim() === "") {
    errors.push("Product Code is required");
  }

  // Quantity On Hand
  if (row.quantityOnHand === undefined || row.quantityOnHand === null || String(row.quantityOnHand).trim() === "") {
    errors.push("Quantity On Hand is required");
  } else {
    const qty = Number(row.quantityOnHand);

    if (!Number.isInteger(qty) || isNaN(qty)) {
      errors.push("Quantity On Hand must be a whole integer");
    } else if (qty < 0) {
      errors.push("Quantity On Hand cannot be negative");
    }
  }

  // Reorder Level (optional)
  if (
    row.reorderLevel !== undefined &&
    row.reorderLevel !== null &&
    String(row.reorderLevel).trim() !== ""
  ) {
    const reorder = Number(row.reorderLevel);

    if (!Number.isInteger(reorder) || isNaN(reorder)) {
      errors.push("Reorder Level must be a whole integer");
    } else if (reorder < 0) {
      errors.push("Reorder Level cannot be negative");
    }
  }

  // Max Stock Level (optional)
  if (
    row.maxStockLevel !== undefined &&
    row.maxStockLevel !== null &&
    String(row.maxStockLevel).trim() !== ""
  ) {
    const max = Number(row.maxStockLevel);

    if (!Number.isInteger(max) || isNaN(max)) {
      errors.push("Maximum Stock Level must be a whole integer");
    } else if (max < 0) {
      errors.push("Maximum Stock Level cannot be negative");
    }
  }

  // Reorder vs Max level check
  if (
    row.reorderLevel !== undefined &&
    row.reorderLevel !== null &&
    String(row.reorderLevel).trim() !== "" &&
    row.maxStockLevel !== undefined &&
    row.maxStockLevel !== null &&
    String(row.maxStockLevel).trim() !== ""
  ) {
    const reorder = Number(row.reorderLevel);
    const max = Number(row.maxStockLevel);

    if (!isNaN(reorder) && !isNaN(max) && max < reorder) {
      errors.push("Maximum Stock Level should not be less than Reorder Level");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Transforms a valid parsed row into an InventoryBulkImportRow.
 */
export function transformRowToInventoryInput(row: ParsedInventoryRow): InventoryBulkImportRow {
  return {
    productCode: String(row.productCode || "").trim(),
    productName: row.productName ? String(row.productName).trim() : undefined,
    quantityOnHand: Number(row.quantityOnHand),
    reorderLevel:
      row.reorderLevel !== undefined &&
      row.reorderLevel !== null &&
      String(row.reorderLevel).trim() !== ""
        ? Number(row.reorderLevel)
        : undefined,
    maxStockLevel:
      row.maxStockLevel !== undefined &&
      row.maxStockLevel !== null &&
      String(row.maxStockLevel).trim() !== ""
        ? Number(row.maxStockLevel)
        : undefined,
  };
}

/**
 * CSV Template generator with standardized header and sample rows.
 */
export const CSV_TEMPLATE_HEADERS = [
  "productCode",
  "productName",
  "quantityOnHand",
  "reorderLevel",
  "maxStockLevel",
] as const;

export function generateInventoryCSVTemplate(): string {
  const sampleRows = [
    ["PROD-001", "Premium Widget", "100", "20", "250"],
    ["PROD-002", "Standard Gadget", "50", "10", "150"],
    ["PROD-003", "Eco Bottle", "200", "30", "500"],
  ];

  const headerLine = CSV_TEMPLATE_HEADERS.join(",");
  const dataLines = sampleRows.map((cols) => cols.join(",")).join("\n");

  return `${headerLine}\n${dataLines}\n`;
}

/**
 * Triggers a browser download for the inventory CSV template.
 */
export function downloadInventoryCSVTemplate(filename = "inventory-bulk-import-template.csv"): void {
  const content = generateInventoryCSVTemplate();

  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
