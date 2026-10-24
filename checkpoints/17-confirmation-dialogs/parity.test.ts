import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);

  return fs.readFileSync(full, "utf-8");
};

describe("Checkpoint 17 — Confirmation Dialogs", () => {
  it("ConfirmDialog component exists and supports destructive actions and busy states", () => {
    const dialog = read("apps/web/src/components/ConfirmDialog.tsx");
    expect(dialog).toContain("ConfirmDialog");
    expect(dialog).toContain("destructive");
    expect(dialog).toContain("busy");
  });

  it("destructive actions on list pages use ConfirmDialog instead of window.confirm", () => {
    const saleList = read("apps/web/src/pages/SaleInvoiceList.tsx");
    expect(saleList).toContain("ConfirmDialog");
    expect(saleList).not.toContain("window.confirm");

    const returnList = read("apps/web/src/pages/ReturnList.tsx");
    expect(returnList).toContain("ConfirmDialog");
    expect(returnList).not.toContain("window.confirm");
  });
});
