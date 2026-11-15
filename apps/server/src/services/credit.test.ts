import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCreditOverview } from "./credit";

const { models } = vi.hoisted(() => ({
  models: {
    sale: { findMany: vi.fn() },
    return: { findMany: vi.fn() },
    payment: { groupBy: vi.fn() },
    customer: { findMany: vi.fn() },
  },
}));

vi.mock("@dms/db", () => ({
  default: models,
  prisma: models,
}));

describe("getCreditOverview service", () => {
  const ORG = "org_test";
  const amt = (whole: number) => `${whole}.00`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates balance due, overdue, and store credit per customer and summary", async () => {
    models.sale.findMany.mockResolvedValue([
      {
        customerId: "cus_1",
        totalAmount: amt(1000),
        amountPaid: amt(200),
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // overdue
      },
      {
        customerId: "cus_2",
        totalAmount: amt(400),
        amountPaid: amt(100),
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // not overdue
      },
    ]);

    models.return.findMany.mockResolvedValue([
      {
        sale: { customerId: "cus_1" },
        items: [{ quantity: 1, unitPrice: amt(100), taxAmount: amt(0), discount: amt(0) }],
      },
    ]);

    models.payment.groupBy
      .mockResolvedValueOnce([
        // unallocated payments
        { customerId: "cus_1", _sum: { amount: amt(50) } },
      ])
      .mockResolvedValueOnce([
        // spent store credit
        { customerId: "cus_1", _sum: { amount: amt(20) } },
      ]);

    models.customer.findMany.mockResolvedValue([
      {
        id: "cus_1",
        name: "Acme Store",
        customerCode: "C-1",
        creditLimit: amt(500),
      },
      {
        id: "cus_2",
        name: "Beta Retail",
        customerCode: "C-2",
        creditLimit: amt(1000),
      },
    ]);

    const result = await getCreditOverview(ORG);

    // cus_1:
    // unpaid = 1000 - 200 = 800
    // returnCredit = 100
    // unallocated = 50
    // balanceDue = 800 - 100 - 50 = 650
    // overdue = 650
    // storeCredit = 100 - 20 = 80
    // creditLimit = 500, balanceDue = 650 -> over limit!
    //
    // cus_2:
    // unpaid = 300, dueDate in future -> overdue = 0
    // balanceDue = 300
    //
    // Summary:
    // balanceDue = 650 + 300 = 950
    // overdue = 650
    // totalStoreCredit = 80
    // overLimitCount = 1
    expect(result.summary).toEqual({
      balanceDue: 950,
      overdue: 650,
      totalStoreCredit: 80,
      overLimitCount: 1,
    });

    const cus1 = result.customers.find((r) => r.customerId === "cus_1");
    expect(cus1).toBeDefined();
    expect(cus1?.balanceDue).toBe(650);
    expect(cus1?.overdue).toBe(650);
    expect(cus1?.storeCredit).toBe(80);
    expect(cus1?.creditLimit).toBe(500);
  });
});
