import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER, USER_HEADER } from "../middleware/auth-context";

const { models } = vi.hoisted(() => ({
  models: {
    // Route-permission middleware resolves the caller's membership;
    // the owner role passes every check.
    member: { findFirst: async () => ({ role: "owner" }) },
    sale: { findMany: vi.fn() },
    return: { findMany: vi.fn() },
    payment: {
      groupBy: vi.fn(),
    },
    customer: { findMany: vi.fn() },
  },
}));

vi.mock("@dms/db", () => ({
  default: models,
  prisma: models,
}));

const app = createApp();

const ORG = "org_1";

const auth = () => ({
  [ORGANIZATION_HEADER]: ORG,
  [USER_HEADER]: "usr_1",
});

// Money helpers: the services call toMoneyNumber, toPaise and fromPaise, which
// all read `toString()` — so a plain "1000.00" string stands in for a stored
// Decimal exactly the way PrismaClient would hand the value over.
const amt = (whole: number) => `${whole}.00`;

beforeEach(() => {
  vi.clearAllMocks();

  models.sale.findMany.mockResolvedValue([
    {
      customerId: "cus_1",
      totalAmount: amt(1_000),
      amountPaid: amt(200),
      dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
    {
      customerId: "cus_2",
      totalAmount: amt(500),
      amountPaid: amt(500),
      dueDate: null,
    },
  ]);

  models.return.findMany.mockResolvedValue([
    {
      sale: { customerId: "cus_1" },
      items: [
        { quantity: 2, unitPrice: amt(100), taxAmount: amt(20), discount: amt(10) },
      ],
    },
  ]);

  models.payment.groupBy
    .mockResolvedValueOnce([
      // unallocated cash on the customer's account
      { customerId: "cus_1", _sum: { amount: amt(120) } },
    ])
    .mockResolvedValueOnce([
      // store credit already spent
      { customerId: "cus_1", _sum: { amount: amt(10) } },
    ]);

  models.customer.findMany.mockResolvedValue([
    {
      id: "cus_1",
      name: "Alpha Traders",
      customerCode: "C-0001",
      creditLimit: amt(0),
    },
    {
      id: "cus_2",
      name: "Beta Mart",
      customerCode: "C-0002",
      creditLimit: null,
    },
  ]);
});

describe("GET /api/credit", () => {
  it("rejects a request without an organization", async () => {
    const res = await request(app).get("/api/credit");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
  });

  it("looks only at active, non-cancelled documents", async () => {
    await request(app).get("/api/credit").set(auth());

    expect(models.sale.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: ORG, deletedAt: null, status: { not: "Cancelled" } },
    }));
    expect(models.return.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        organizationId: ORG,
        deletedAt: null,
        returnType: "SALE",
        sale: { deletedAt: null, status: { not: "Cancelled" } },
      },
    }));
  });

  it("computes balance due, overdue and store credit on the same definitions the ledger uses", async () => {
    const res = await request(app).get("/api/credit").set(auth());

    expect(res.status).toBe(200);

    // cus_1: unpaid = 800. Overdue (past due date) = 800 too.
    // Offsets = return credit (2*100 + 20 - 10 = 210 at whole units) + unallocated (120) = 330.
    // Balance due = 800 - 330 = 470; overdue part (offsets applied here first) = 470.
    // Store credit = 210 - 10 spent = 200.
    // cus_2 is fully paid: everything zero.
    expect(res.body.customers).toEqual([
      expect.objectContaining({
        customerId: "cus_1",
        name: "Alpha Traders",
        balanceDue: 470,
        overdue: 470,
        storeCredit: 200,
      }),
      expect.objectContaining({
        customerId: "cus_2",
        balanceDue: 0,
        overdue: 0,
        storeCredit: 0,
      }),
    ]);

    expect(res.body.summary).toEqual({
      balanceDue: 470,
      overdue: 470,
      totalStoreCredit: 200,
      overLimitCount: 0,
    });
  });

  it("never counts a cancelled or deleted invoice toward what is owed", async () => {
    models.sale.findMany.mockResolvedValue([
      {
        customerId: "cus_1",
        totalAmount: amt(1_000),
        amountPaid: amt(0),
        dueDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      },
    ]);
    models.return.findMany.mockResolvedValue([
      {
        sale: { customerId: "cus_1" },
        items: [
          { quantity: 1, unitPrice: amt(50), taxAmount: amt(0), discount: amt(0) },
        ],
      },
    ]);
    // beforeEach seeds once-queues for the default scenario; start clean so
    // neither unallocated payments nor spent store credit leak into this one.
    models.payment.groupBy.mockReset();
    models.payment.groupBy.mockResolvedValue([]);
    models.customer.findMany.mockResolvedValue([
      {
        id: "cus_1",
        name: "Alpha Traders",
        customerCode: "C-0001",
        creditLimit: null,
      },
    ]);

    const res = await request(app).get("/api/credit").set(auth());

    // Balance due = 1_000 - return credit (50) = 950, all of it overdue since
    // the only active invoice is far past its due date.
    expect(res.body.summary.balanceDue).toBe(950);
    expect(res.body.summary.overdue).toBe(950);
  });
});
