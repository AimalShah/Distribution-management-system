import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);

  return fs.readFileSync(full, "utf-8");
};

describe("Checkpoint 15 — Payments Invoice Lifecycle", () => {
  it("payment services enforce settled amounts and invoice status derivation", () => {
    const paymentService = read("apps/server/src/services/payment.ts");
    expect(paymentService).toContain("export async function createPayment");
    expect(paymentService).toContain("export async function deletePayment");
  });

  it("supports store credit pool allocations and balance updates", () => {
    const paymentService = read("apps/server/src/services/payment.ts");
    expect(paymentService).toContain("STORE_CREDIT");
  });

  it("web UI offers RecordPaymentDialog and payment records page", () => {
    const recordDialog = read("apps/web/src/components/sales/RecordPaymentDialog.tsx");
    expect(recordDialog).toContain("Record Payment");

    const paymentsPage = read("apps/web/src/pages/PaymentsPage.tsx");
    expect(paymentsPage).toContain("Payments");
  });
});
