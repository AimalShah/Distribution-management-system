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

/**
 * Triggers a browser download for any CSV content string.
 */
export function downloadCSV(filename: string, content: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Serializes an array of records to a CSV string with escaped fields.
 */
export function recordsToCSV(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[]
): string {
  const headerLine = columns.map((col) => `"${col.label.replace(/"/g, '""')}"`).join(",");

  const dataLines = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col.key];

        if (val === null || val === undefined) return '""';

        const str = String(val).replace(/"/g, '""');

        return `"${str}"`;
      })
      .join(",")
  );

  return [headerLine, ...dataLines].join("\n");
}

export function exportProductsCSV(products: any[], filename = "products-export.csv"): void {
  const columns = [
    { key: "productCode", label: "Product Code" },
    { key: "name", label: "Product Name" },
    { key: "brand", label: "Brand" },
    { key: "category", label: "Category" },
    { key: "unitPrice", label: "Unit Price (PKR)" },
    { key: "costPrice", label: "Cost Price (PKR)" },
    { key: "quantityOnHand", label: "Quantity On Hand" },
    { key: "reorderLevel", label: "Reorder Level" },
    { key: "taxPercent", label: "Tax %" },
  ];

  const rows = (products || []).map((p) => ({
    productCode: p.productCode ?? "",
    name: p.name ?? "",
    brand: p.brand?.name ?? p.brandName ?? "",
    category: p.category?.name ?? p.categoryName ?? "",
    unitPrice: p.unitPrice ?? 0,
    costPrice: p.costPrice ?? 0,
    quantityOnHand: p.inventory?.quantityOnHand ?? p.quantityOnHand ?? 0,
    reorderLevel: p.inventory?.reorderLevel ?? p.reorderLevel ?? 0,
    taxPercent: p.taxPercent ?? 0,
  }));

  downloadCSV(filename, recordsToCSV(rows, columns));
}

export function exportCustomersCSV(customers: any[], filename = "customers-export.csv"): void {
  const columns = [
    { key: "customerCode", label: "Customer Code" },
    { key: "name", label: "Customer Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "address", label: "Address" },
    { key: "gstin", label: "GSTIN / NTN" },
    { key: "creditLimit", label: "Credit Limit (PKR)" },
    { key: "balance", label: "Outstanding Balance (PKR)" },
  ];

  const rows = (customers || []).map((c) => ({
    customerCode: c.customerCode ?? "",
    name: c.name ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
    gstin: c.gstin ?? "",
    creditLimit: c.creditLimit ?? 0,
    balance: c.balance ?? 0,
  }));

  downloadCSV(filename, recordsToCSV(rows, columns));
}

export function exportSalesCSV(sales: any[], filename = "sales-invoices-export.csv"): void {
  const columns = [
    { key: "saleCode", label: "Invoice Code" },
    { key: "saleDate", label: "Invoice Date" },
    { key: "customer", label: "Customer Name" },
    { key: "status", label: "Status" },
    { key: "totalAmount", label: "Total Amount (PKR)" },
    { key: "amountPaid", label: "Amount Paid (PKR)" },
    { key: "balanceDue", label: "Balance Due (PKR)" },
  ];

  const rows = (sales || []).map((s) => {
    const total = Number(s.totalAmount ?? 0);
    const paid = Number(s.amountPaid ?? 0);

    return {
      saleCode: s.saleCode ?? "",
      saleDate: s.saleDate ? new Date(s.saleDate).toLocaleDateString() : "",
      customer: s.customer?.name ?? s.customerName ?? "",
      status: s.status ?? "",
      totalAmount: total,
      amountPaid: paid,
      balanceDue: Math.max(0, total - paid),
    };
  });

  downloadCSV(filename, recordsToCSV(rows, columns));
}

export function exportCustomerLedgerCSV(
  customerName: string,
  entries: any[],
  filename?: string
): void {
  const columns = [
    { key: "date", label: "Date" },
    { key: "type", label: "Type" },
    { key: "reference", label: "Reference" },
    { key: "description", label: "Description" },
    { key: "debit", label: "Debit (PKR)" },
    { key: "credit", label: "Credit (PKR)" },
    { key: "balance", label: "Running Balance (PKR)" },
  ];

  const rows = (entries || []).map((e) => ({
    date: e.date ? new Date(e.date).toLocaleDateString() : "",
    type: e.type ?? "",
    reference: e.reference ?? "",
    description: e.description ?? e.reason ?? "",
    debit: e.debit ?? (e.amount > 0 && e.direction === "debit" ? e.amount : ""),
    credit: e.credit ?? (e.amount > 0 && e.direction === "credit" ? e.amount : ""),
    balance: e.runningBalance ?? e.balance ?? "",
  }));

  const name = customerName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  downloadCSV(filename || `ledger-${name}.csv`, recordsToCSV(rows, columns));
}
