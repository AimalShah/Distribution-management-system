# Checkpoint 10 — Bulk Import, Wired for Real: Plan

## Goal

Rebuild `AddInventoryForm.tsx` against the real schema and real Express routes, with real CSV parsing (`papaparse`) on the Import CSV button.

## Current State (from gap analysis)

- `AddInventoryForm.tsx` exists but may not match the real schema
- Import CSV button exists but may not be fully wired
- No real CSV parsing implementation

## Implementation Steps

### 1. Schema alignment
- Audit `AddInventoryForm.tsx` against the real `Inventory` and `Product` models
- Ensure all form fields match the Prisma schema
- Add missing fields, remove non-existent ones

### 2. CSV parsing with papaparse
- Add `papaparse` dependency to `apps/web`
- Create `apps/web/src/lib/csv.ts` — CSV parsing utilities:
  - `parseInventoryCSV(file: File): Promise<ParsedInventoryRow[]>`
  - `validateInventoryRow(row: ParsedInventoryRow): ValidationResult`
  - `transformRowToInventoryInput(row: ParsedInventoryRow): InventoryInput`

### 3. Express bulk import endpoint
- `POST /api/inventory/bulk-import` — accepts CSV file, parses and validates each row
- Returns: `{ success: number, errors: Array<{ row: number, error: string }> }`
- Uses `$transaction` for atomic import
- Creates Inventory records for valid rows, collects errors for invalid rows

### 4. React UI
- Rebuild `AddInventoryForm.tsx`:
  - Manual entry form (aligned with real schema)
  - "Import CSV" button that opens file picker
  - CSV template download
  - Preview table showing parsed rows before import
  - Error display for invalid rows
  - Progress indicator during import

### 5. CSV Template
- Provide downloadable CSV template with columns:
  - productCode, productName, quantityOnHand, reorderLevel, maxStockLevel

## Verification

- CSV file parses correctly with papaparse
- Valid rows are imported successfully
- Invalid rows show clear error messages
- Preview table shows parsed data before import
- Bulk import endpoint handles large files
- Form fields match the real schema
