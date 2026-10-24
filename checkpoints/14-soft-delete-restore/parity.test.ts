import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);

  return fs.readFileSync(full, "utf-8");
};

describe("Checkpoint 14 — Soft Delete & Restore (Invoices, Returns)", () => {
  it("schema includes deletedAt timestamp on sales and returns", () => {
    const schema = read("packages/db/prisma/schema.prisma");
    expect(schema).toContain("deletedAt DateTime?");
  });

  it("server services implement soft delete and restore with stock reversal", () => {
    const saleService = read("apps/server/src/services/sale.ts");
    expect(saleService).toContain("export async function deleteSale");
    expect(saleService).toContain("export async function restoreSale");

    const returnService = read("apps/server/src/services/return.ts");
    expect(returnService).toContain("export async function deleteReturn");
    expect(returnService).toContain("export async function restoreReturn");
  });

  it("web lists support active vs deleted views with restore actions", () => {
    const saleList = read("apps/web/src/pages/SaleInvoiceList.tsx");
    expect(saleList).toContain("deleted");
    expect(saleList).toContain("Restore");

    const returnList = read("apps/web/src/pages/ReturnList.tsx");
    expect(returnList).toContain("deleted");
    expect(returnList).toContain("Restore");
  });
});
