import { describe, expect, it } from "vitest";
import {
  calculateSaleBreakdown,
  fromPaise,
  normalizeDecimalValues,
  percentagePaise,
  toMoneyNumber,
  toPaise,
} from "@dms/shared";

describe("integer-paise arithmetic", () => {
  it("rounds decimal inputs to paise without floating-point half-cent loss", () => {
    expect(toPaise(1.005)).toBe(101n);
    expect(toPaise(-1.005)).toBe(-101n);
  });

  it("calculates percentages in integer paise with half-up rounding", () => {
    expect(percentagePaise(105n, 10)).toBe(11n);
    expect(percentagePaise(101n, 10)).toBe(10n);
    expect(percentagePaise(12_345n, 8.25)).toBe(1_018n);
  });

  it("converts paise to the numeric API amount only at the boundary", () => {
    expect(fromPaise(123_456n)).toBe(1_234.56);
    expect(toMoneyNumber("1234.56")).toBe(1_234.56);
  });

  it("calculates sale GST and totals from paise integers", () => {
    const sale = calculateSaleBreakdown({
      items: [{ productId: "item", quantity: 1, unitPrice: 100.05, taxPercent: 10 }],
      isInterState: true,
    });

    expect(sale.subtotal).toBe(100.05);
    expect(sale.taxAmount).toBe(10.01);
    expect(sale.total).toBe(110.06);
  });

  it("serializes nested Decimal values as numeric JSON fields", () => {
    const decimal = Object.assign(new String("123.45"), { toString: () => "123.45" });
    Object.defineProperty(decimal, "constructor", { value: { name: "Decimal" } });

    expect(normalizeDecimalValues({ amount: decimal, rows: [{ amount: decimal }] })).toEqual({
      amount: 123.45,
      rows: [{ amount: 123.45 }],
    });
  });
});
