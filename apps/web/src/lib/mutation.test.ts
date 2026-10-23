import { describe, expect, it } from "vitest";
import { keyMatchesDomains } from "./mutation";

/**
 * The invalidation contract: which cached keys a domain's mutation must reach.
 * These are the exact key shapes the screens build today (pages/components
 * in apps/web), asserted so a refactor that silently stops invalidating a
 * surface — the bug class this whole module exists to close — shows up here.
 */
describe("keyMatchesDomains", () => {
  it("reaches every sibling-key spelling of one resource", () => {
    const sales = ["sales"] as const;

    expect(keyMatchesDomains("/sales?page=1&pageSize=10", sales)).toBe(true);
    expect(keyMatchesDomains("/sales?status=Paid&search=abc", sales)).toBe(true);
    expect(keyMatchesDomains("/sales", sales)).toBe(true);
  });

  it("a sale mutation reaches stock, ledger, dashboard and reports", () => {
    const domains = ["sales", "inventory", "customers", "dashboard", "reports"] as const;

    expect(keyMatchesDomains("/inventory?page=2", domains)).toBe(true);
    expect(keyMatchesDomains("/inventory/batches?expiry=soon", domains)).toBe(true);
    expect(keyMatchesDomains("/inventory/low-stock?page=1", domains)).toBe(true);
    expect(keyMatchesDomains("/customers/abc-123/ledger?from=2026-01-01", domains)).toBe(true);
    expect(keyMatchesDomains("/dashboard/stats", domains)).toBe(true);
    expect(keyMatchesDomains("/reports/sales/full?from=2026-01-01", domains)).toBe(true);
  });

  it("a payment reaches the invoice rows surfaced under /sales/customer/:id", () => {
    const domains = ["payments", "sales", "customers"] as const;

    expect(keyMatchesDomains("/sales/customer/cst-1?pageSize=100", domains)).toBe(true);
    expect(keyMatchesDomains("/payments?page=1&pageSize=20", domains)).toBe(true);
  });

  it("never leaks into unrelated domains", () => {
    const domains = ["payments"] as const;

    expect(keyMatchesDomains("/sales?page=1", domains)).toBe(false);
    expect(keyMatchesDomains("/returns?pageSize=20", domains)).toBe(false);
    expect(keyMatchesDomains("/roles", domains)).toBe(false);
  });

  it("answers false for SWR's non-string keys", () => {
    expect(keyMatchesDomains(["/sales", "cst-1"], ["sales"])).toBe(false);
    expect(keyMatchesDomains(null, ["sales"])).toBe(false);
    expect(keyMatchesDomains(undefined, ["sales"])).toBe(false);
  });
});
