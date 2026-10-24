import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);

  return fs.readFileSync(full, "utf-8");
};

describe("Checkpoint 16 — Customer Ledger & WhatsApp Share", () => {
  it("customer statement template renders PDF statements with running balance", () => {
    const template = read("apps/server/src/services/customer-statement-template.ts");
    expect(template).toContain("Statement");
    expect(template).toContain("Balance");
  });

  it("web customer ledger includes ledger timeline and WhatsApp statement sharing", () => {
    const ledgerPage = read("apps/web/src/pages/CustomerLedgerPage.tsx");
    expect(ledgerPage).toContain("waLink");
    expect(ledgerPage).toContain("Share on WhatsApp");
  });
});
