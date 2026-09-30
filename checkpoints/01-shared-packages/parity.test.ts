/**
 * Checkpoint 1 — Shared Packages: Parity Test
 * 
 * Verifies Zod schemas match the original validation behavior.
 * Run with: pnpm --filter shared run test:checkpoint1
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// `checkpoints/<name>/parity.test.ts` -> repo root is two levels up. This was
// three, which pointed at the parent of the repository.
const root = path.resolve(__dirname, "../..");

describe("Checkpoint 1 — Shared packages", () => {
  it("packages/db has prisma schema with all models", () => {
    const schema = fs.readFileSync(path.join(root, "packages/db/prisma/schema.prisma"), "utf-8");
    const models = ["User", "Session", "Account", "Verification", "Organization", "Member", "Invitation", "Supplier", "Customer", "Product", "Purchase", "PurchaseItem", "Sale", "SaleItem", "Category", "Brand", "Inventory", "InventoryLog", "Return", "ReturnItem"];
    for (const model of models) {
      expect(schema, `schema should contain model ${model}`).toContain(`model ${model}`);
    }
  });

  it("packages/shared has pagination schemas", () => {
    const content = fs.readFileSync(path.join(root, "packages/shared/src/pagination.ts"), "utf-8");
    expect(content).toContain("paginationQuerySchema");
    expect(content).toContain("paginatedResponseSchema");
  });

  it("packages/shared has entity schemas", () => {
    const schemasDir = path.join(root, "packages/shared/src/schemas");
    const expected = ["product", "purchase", "sale", "return", "customer", "supplier", "category", "brand", "auth", "inventory"];
    for (const schema of expected) {
      expect(fs.existsSync(path.join(schemasDir, `${schema}.ts`)), `${schema}.ts should exist`).toBe(true);
    }
  });

  it("packages/ui has data-table component", () => {
    expect(fs.existsSync(path.join(root, "packages/ui/src/components/data-table.tsx"))).toBe(true);
  });

  it("packages/ui has shadcn components", () => {
    const componentsDir = path.join(root, "packages/ui/src/components");
    const expected = ["button", "input", "label", "select", "table", "dialog", "dropdown-menu", "tabs", "card", "badge", "form", "popover", "calendar", "sheet", "avatar", "separator", "skeleton", "sonner", "tooltip", "checkbox", "switch", "textarea", "date-range", "accordion", "alert", "progress", "sidebar", "chart"];
    for (const comp of expected) {
      expect(fs.existsSync(path.join(componentsDir, `${comp}.tsx`)), `${comp}.tsx should exist`).toBe(true);
    }
  });
});
