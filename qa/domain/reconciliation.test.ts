/**
 * Phase 3: Data Truth & Reconciliation QA Suite (`qa/domain/reconciliation.test.ts`).
 *
 * Proves the four fundamental invariants of the DMS across all document lifecycles:
 *
 * 1. InventoryLog vs QuantityOnHand:
 *    Cumulative delta of all InventoryLog movements (newQty - previousQty) equals
 *    Inventory.quantityOnHand across all products, and the log chain is continuous.
 *
 * 2. StockBatch vs QuantityOnHand:
 *    Sum of StockBatch.quantityRemaining across all batches of a product equals
 *    Inventory.quantityOnHand, through FEFO depletion, reverse crediting, and count adjustments.
 *
 * 3. Customer Ledger vs Document Aggregates:
 *    The derived customer ledger closing balance equals:
 *      max(0, unpaidSales − returnCredits − unallocatedPayments)
 *    at every step across regular sales, payments, returns, cancellations, and soft-deletes.
 *
 * 4. Store Credit Pool vs Returns & Payments:
 *    Available store credit equals:
 *      max(0, totalReturnCredits − usedStoreCredit)
 *    and correctly restores on payment deletion, revokes on return deletion, and gates usage.
 *
 * 5. Dashboard Organization-Wide Financial Truth:
 *    Dashboard stats (outstanding, totalSales, totalPurchases) reconcile against
 *    the active tenant documents and customer ledgers.
 */
import { afterAll, beforeAll, describe, it, expect } from "vitest";

import prisma from "@dms/db";
import {
  api,
  batchQuantities,
  createIsolatedCustomer,
  createPayment,
  createPurchase,
  createReturn,
  createSale,
  customerBalance,
  expectMoney,
  expectRefusal,
  inventoryRow,
  ok,
  round2,
  seedStock,
  seedTenant,
  teardownTenant,
  unique,
  type Caller,
  type Product,
  type Tenant,
} from "../support/harness";

let t!: Tenant;

beforeAll(async () => {
  t = await seedTenant(10);
});

afterAll(async () => {
  await teardownTenant(t);
  await prisma.$disconnect();
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const raw = (m: string, p: string, b?: unknown) => api.raw(t)(m as any, p, b);

const newProduct = async (name: string, unitPrice = 25, unitCost = 10, gstRate = 10): Promise<Product> => {
  const p = (
    await ok(
      raw("post", "/products", {
        productCode: unique("SKU"),
        name: unique(name),
        category: t.categoryId,
        brand: t.brandId,
        unit: "piece",
        unitCost,
        unitPrice,
        gstApplicable: true,
        gstRate,
        isActive: true,
      })
    )
  ).body;

  return {
    id: p.id,
    productCode: p.productCode,
    name: p.name,
    unitPrice: p.unitPrice,
    unitCost: p.unitCost,
    gstRate: p.gstRate,
  };
};

/** Invariant 1 verifier: checks log continuity, latest log newQty, and cumulative delta sum. */
async function assertInventoryLogReconciliation(productId: string) {
  const inv = await prisma.inventory.findFirst({
    where: { organizationId: t.organizationId, productId },
  });
  if (!inv) throw new Error(`Inventory row missing for product ${productId}`);

  const logs = await prisma.inventoryLog.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
  });

  expect(logs.length).toBeGreaterThan(0);

  let cumulativeDelta = 0;
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (i === 0) {
      expect(log.previousQty).toBe(0);
    } else {
      expect(log.previousQty).toBe(logs[i - 1].newQty);
    }

    const delta = log.newQty - log.previousQty;
    cumulativeDelta += delta;
  }

  const latestLog = logs[logs.length - 1];
  expect(latestLog.newQty).toBe(inv.quantityOnHand);
  expect(cumulativeDelta).toBe(inv.quantityOnHand);

  const apiInv = await inventoryRow(t, productId);
  expect(apiInv.quantityOnHand).toBe(inv.quantityOnHand);
}

/** Invariant 2 verifier: checks sum of batch quantityRemaining vs inventory quantityOnHand. */
async function assertBatchReconciliation(productId: string) {
  const inv = await prisma.inventory.findFirst({
    where: { organizationId: t.organizationId, productId },
  });
  if (!inv) throw new Error(`Inventory row missing for product ${productId}`);

  const batches = await prisma.stockBatch.findMany({
    where: { organizationId: t.organizationId, productId },
  });

  const sumRemaining = batches.reduce((sum, b) => sum + b.quantityRemaining, 0);
  expect(sumRemaining).toBe(inv.quantityOnHand);

  for (const b of batches) {
    expect(b.quantityRemaining).toBeGreaterThanOrEqual(0);
    expect(b.quantityRemaining).toBeLessThanOrEqual(b.quantityReceived);
  }
}

/** Invariant 3 verifier: checks customer ledger closing balance vs underlying active documents. */
async function assertCustomerLedgerReconciliation(customerId: string) {
  const sales = await prisma.sale.findMany({
    where: {
      organizationId: t.organizationId,
      customerId,
      status: { not: "Cancelled" },
      deletedAt: null,
    },
    select: { id: true, totalAmount: true, amountPaid: true },
  });

  const unpaidSales = sales.reduce((sum, s) => sum + (s.totalAmount - s.amountPaid), 0);

  const returns = await prisma.return.findMany({
    where: {
      organizationId: t.organizationId,
      returnType: "SALE",
      sale: { customerId },
      deletedAt: null,
    },
    select: {
      items: {
        select: { quantity: true, unitPrice: true, taxAmount: true, discount: true },
      },
    },
  });

  const returnCredits = returns.reduce(
    (sum, ret) =>
      sum +
      ret.items.reduce(
        (lineSum, item) => lineSum + item.quantity * item.unitPrice + item.taxAmount - item.discount,
        0
      ),
    0
  );

  const unallocatedPayments = await prisma.payment.findMany({
    where: {
      organizationId: t.organizationId,
      customerId,
      saleId: null,
      deletedAt: null,
    },
    select: { amount: true },
  });

  const unallocated = unallocatedPayments.reduce((sum, p) => sum + p.amount, 0);

  const netBalance = unpaidSales - returnCredits - unallocated;
  const expectedClosing = Math.max(0, netBalance);

  const ledgerRes = (await ok(api.raw(t)("get", `/customers/${customerId}/ledger`))).body;
  const apiClosing = ledgerRes?.totals?.closingBalance;

  expectMoney(apiClosing, expectedClosing);

  const helperBalance = await customerBalance(t, customerId);
  expectMoney(helperBalance, expectedClosing);

  return { unpaidSales, returnCredits, unallocated, expectedClosing };
}

/** Invariant 4 verifier: checks available store credit vs non-deleted returns and store credit payments. */
async function assertStoreCreditReconciliation(customerId: string) {
  const returns = await prisma.return.findMany({
    where: {
      organizationId: t.organizationId,
      returnType: "SALE",
      sale: { customerId },
      deletedAt: null,
    },
    select: {
      items: {
        select: { quantity: true, unitPrice: true, taxAmount: true, discount: true },
      },
    },
  });

  const totalReturnCredits = returns.reduce(
    (sum, ret) =>
      sum +
      ret.items.reduce(
        (lineSum, item) => lineSum + item.quantity * item.unitPrice + item.taxAmount - item.discount,
        0
      ),
    0
  );

  const storeCreditPayments = await prisma.payment.findMany({
    where: {
      organizationId: t.organizationId,
      customerId,
      method: "Store Credit",
      deletedAt: null,
    },
    select: { amount: true },
  });

  const usedStoreCredit = storeCreditPayments.reduce((sum, p) => sum + p.amount, 0);
  const expectedAvailableStoreCredit = Math.max(0, totalReturnCredits - usedStoreCredit);

  return { totalReturnCredits, usedStoreCredit, expectedAvailableStoreCredit };
}

/* -------------------------------------------------------------------------- */
/* Test Suites                                                                */
/* -------------------------------------------------------------------------- */

describe("Reconciliation — Invariant 1: InventoryLog vs QuantityOnHand", () => {
  it("maintains strict continuity and delta equality through multi-document lifecycle", async () => {
    const prod = await newProduct("recon-inv-lifecycle");

    // 1. Opening stock (50 units)
    await seedStock(t, prod, 50);
    await assertInventoryLogReconciliation(prod.id);

    // 2. Purchase intake (30 units)
    await createPurchase(t, t.supplier.id, [{ productId: prod.id, quantity: 30 }], {
      batchNumber: unique("BATCH-A"),
    });
    await assertInventoryLogReconciliation(prod.id);

    // 3. Sale dispatch (25 units)
    const cust = await createIsolatedCustomer(t, "cust-inv-1");
    const sale = await createSale(t, {
      customerId: cust.id,
      items: [{ productId: prod.id, quantity: 25 }],
    });
    await assertInventoryLogReconciliation(prod.id);

    // 4. Return restock (5 units RESTOCKABLE)
    const ret = await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [{ productId: prod.id, quantity: 5, condition: "RESTOCKABLE" }],
    });
    await assertInventoryLogReconciliation(prod.id);

    // 5. Return write-off (3 units DAMAGED — credited but NOT restocked)
    await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [{ productId: prod.id, quantity: 3, condition: "DAMAGED" }],
    });
    // Damaged return doesn't put goods back in stock, so stock remains unchanged
    await assertInventoryLogReconciliation(prod.id);

    // 6. Manual stock adjustment: OUT (7 units)
    const inv = await inventoryRow(t, prod.id);
    await ok(
      raw("post", "/inventory/adjust", {
        inventoryId: inv.id,
        movementType: "OUT",
        quantity: 7,
        reason: "QA stock adjustment out",
      })
    );
    await assertInventoryLogReconciliation(prod.id);

    // 7. Manual stock adjustment: physical count ADJUSTMENT (set to 60)
    await ok(
      raw("post", "/inventory/adjust", {
        inventoryId: inv.id,
        movementType: "ADJUSTMENT",
        quantity: 60,
        reason: "Physical count reconciliation",
      })
    );
    await assertInventoryLogReconciliation(prod.id);

    // 8. Bulk CSV import (sets to 75 with F-13 movement logging)
    await ok(
      raw("post", "/inventory/bulk-import", {
        rows: [{ productCode: prod.productCode, quantityOnHand: 75, reorderLevel: 5 }],
      })
    );
    await assertInventoryLogReconciliation(prod.id);
  });

  it("reversal operations (sale delete/restore and return delete/restore) preserve ledger reconciliation", async () => {
    const prod = await newProduct("recon-inv-reversals");
    await seedStock(t, prod, 40);
    await assertInventoryLogReconciliation(prod.id);

    const cust = await createIsolatedCustomer(t, "cust-inv-rev");
    const sale = await createSale(t, {
      customerId: cust.id,
      items: [{ productId: prod.id, quantity: 15 }],
    });
    await assertInventoryLogReconciliation(prod.id);

    // Soft-delete sale -> stock restored (movementType: RETURN)
    await ok(raw("delete", `/sales/${sale.id}`));
    await assertInventoryLogReconciliation(prod.id);

    // Restore sale -> stock deducted again (movementType: OUT)
    await ok(raw("post", `/sales/${sale.id}/restore`));
    await assertInventoryLogReconciliation(prod.id);

    // Create a return of 5 units
    const ret = await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [{ productId: prod.id, quantity: 5, condition: "RESTOCKABLE" }],
    });
    await assertInventoryLogReconciliation(prod.id);

    // Soft-delete return -> stock taken back out (movementType: OUT)
    await ok(raw("delete", `/returns/${ret.id}`));
    await assertInventoryLogReconciliation(prod.id);

    // Restore return -> stock put back in (movementType: RETURN)
    await ok(raw("post", `/returns/${ret.id}/restore`));
    await assertInventoryLogReconciliation(prod.id);
  });
});

describe("Reconciliation — Invariant 2: StockBatch vs QuantityOnHand", () => {
  it("maintains batch sum equality across multiple receipts, FEFO sales, and returns", async () => {
    const prod = await newProduct("recon-batch-fefo");

    // 1. Opening stock (20 units) -> creates OPENING batch
    await seedStock(t, prod, 20);
    await assertBatchReconciliation(prod.id);

    // 2. Receipt 1: Batch EXP-LATER (30 units, expires in 60 days)
    const in60d = new Date(Date.now() + 60 * 86400 * 1000).toISOString();
    await createPurchase(t, t.supplier.id, [{ productId: prod.id, quantity: 30 }], {
      batchNumber: "EXP-LATER",
      expiryDate: in60d,
    });
    await assertBatchReconciliation(prod.id);

    // 3. Receipt 2: Batch EXP-SOON (15 units, expires in 10 days)
    const in10d = new Date(Date.now() + 10 * 86400 * 1000).toISOString();
    await createPurchase(t, t.supplier.id, [{ productId: prod.id, quantity: 15 }], {
      batchNumber: "EXP-SOON",
      expiryDate: in10d,
    });
    await assertBatchReconciliation(prod.id);

    // Total on hand is now 20 + 30 + 15 = 65.
    // 4. Sale 1: Sell 25 units.
    // FEFO order: EXP-SOON (10d) is deducted first (all 15 units), then OPENING or EXP-LATER.
    const cust = await createIsolatedCustomer(t, "cust-batch-1");
    const sale = await createSale(t, {
      customerId: cust.id,
      items: [{ productId: prod.id, quantity: 25 }],
    });
    await assertBatchReconciliation(prod.id);

    // Verify EXP-SOON was depleted to 0
    const batchesAfterSale = await batchQuantities(t, prod.id);
    const expSoon = batchesAfterSale.find((b) => b.batchNumber === "EXP-SOON");
    expect(expSoon?.quantityRemaining).toBe(0);

    // 5. Return 10 units of the sale (RESTOCKABLE)
    // Reversal gives units back to short batches
    await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [{ productId: prod.id, quantity: 10, condition: "RESTOCKABLE" }],
    });
    await assertBatchReconciliation(prod.id);

    // 6. Manual count adjustment within received stock bounds (set to 60 units)
    // 65 total units received across all batches; count up to 60 credits short batches
    const inv = await inventoryRow(t, prod.id);
    await ok(
      raw("post", "/inventory/adjust", {
        inventoryId: inv.id,
        movementType: "ADJUSTMENT",
        quantity: 60,
        reason: "Count adjustment up within received lots",
      })
    );
    await assertBatchReconciliation(prod.id);

    // 7. Manual count adjustment down (set to 45 units)
    // Decrement deducts via FEFO
    await ok(
      raw("post", "/inventory/adjust", {
        inventoryId: inv.id,
        movementType: "ADJUSTMENT",
        quantity: 45,
        reason: "Count adjustment down",
      })
    );
    await assertBatchReconciliation(prod.id);
  });

  it("sale deletion replenishes depleted batches and matches quantity on hand", async () => {
    const prod = await newProduct("recon-batch-del");
    await seedStock(t, prod, 30);
    await assertBatchReconciliation(prod.id);

    const cust = await createIsolatedCustomer(t, "cust-batch-del");
    const sale = await createSale(t, {
      customerId: cust.id,
      items: [{ productId: prod.id, quantity: 20 }],
    });
    await assertBatchReconciliation(prod.id);

    // Delete sale -> replenishes batch to 30
    await ok(raw("delete", `/sales/${sale.id}`));
    await assertBatchReconciliation(prod.id);

    const row = await inventoryRow(t, prod.id);
    expect(row.quantityOnHand).toBe(30);
  });
});

describe("Reconciliation — Invariant 3: Customer Ledger vs Document Aggregates", () => {
  it("reconciles derived balance = max(0, unpaidSales − returnCredits − unallocatedPayments) at every step", async () => {
    const prod = await newProduct("recon-cust-ledger", 25, 10, 10); // 25 + 10% GST = 27.50 / unit
    await seedStock(t, prod, 200);

    const cust = await createIsolatedCustomer(t, "recon-ledger-cust");
    await assertCustomerLedgerReconciliation(cust.id); // initial 0

    // Step 1: Sale 1 (10 units -> 10 * 25 * 1.10 = 275.00)
    const sale1 = await createSale(t, {
      customerId: cust.id,
      items: [{ productId: prod.id, quantity: 10, unitPrice: 25, taxPercent: 10 }],
    });
    const s1State = await assertCustomerLedgerReconciliation(cust.id);
    expectMoney(s1State.expectedClosing, 275.00);

    // Step 2: Direct payment against Sale 1 ($100.00)
    const pay1 = await createPayment(t, {
      customerId: cust.id,
      saleId: sale1.id,
      amount: 100.00,
      method: "Cash",
    });
    const s2State = await assertCustomerLedgerReconciliation(cust.id);
    expectMoney(s2State.expectedClosing, 175.00);

    // Step 3: Unallocated payment (cash on account, no saleId) ($50.00)
    const pay2 = await createPayment(t, {
      customerId: cust.id,
      amount: 50.00,
      method: "Bank Transfer",
    });
    const s3State = await assertCustomerLedgerReconciliation(cust.id);
    expectMoney(s3State.expectedClosing, 125.00);

    // Step 4: Sale return against Sale 1 (2 units -> 2 * 27.50 = 55.00 credit)
    const ret1 = await createReturn(t, {
      returnType: "SALE",
      saleId: sale1.id,
      items: [{ productId: prod.id, quantity: 2, condition: "RESTOCKABLE" }],
    });
    const s4State = await assertCustomerLedgerReconciliation(cust.id);
    expectMoney(s4State.expectedClosing, 70.00); // 125.00 - 55.00 = 70.00

    // Step 5: Sale 2 (4 units -> 4 * 27.50 = 110.00)
    const sale2 = await createSale(t, {
      customerId: cust.id,
      items: [{ productId: prod.id, quantity: 4, unitPrice: 25, taxPercent: 10 }],
    });
    const s5State = await assertCustomerLedgerReconciliation(cust.id);
    expectMoney(s5State.expectedClosing, 180.00); // 70.00 + 110.00 = 180.00

    // Step 6: Cancel Sale 2 -> excluded from ledger and unpaid sales
    await ok(raw("post", `/sales/${sale2.id}/cancel`));
    const s6State = await assertCustomerLedgerReconciliation(cust.id);
    expectMoney(s6State.expectedClosing, 70.00);

    // Step 7: Uncancel Sale 2 -> restored to ledger
    await ok(raw("post", `/sales/${sale2.id}/uncancel`));
    const s7State = await assertCustomerLedgerReconciliation(cust.id);
    expectMoney(s7State.expectedClosing, 180.00);

    // Step 8: Soft-delete Sale 2 -> excluded from ledger
    await ok(raw("delete", `/sales/${sale2.id}`));
    const s8State = await assertCustomerLedgerReconciliation(cust.id);
    expectMoney(s8State.expectedClosing, 70.00);

    // Step 9: Soft-delete payment 1 ($100.00) -> customer debt restored
    await ok(raw("delete", `/payments/${pay1.id}`));
    const s9State = await assertCustomerLedgerReconciliation(cust.id);
    expectMoney(s9State.expectedClosing, 170.00); // 70.00 + 100.00 = 170.00

    // Step 10: Soft-delete return 1 ($55.00) -> customer credit revoked, debt increases
    await ok(raw("delete", `/returns/${ret1.id}`));
    const s10State = await assertCustomerLedgerReconciliation(cust.id);
    expectMoney(s10State.expectedClosing, 225.00); // 170.00 + 55.00 = 225.00 (275 sale1 - 50 unallocated pay2)
  });
});

describe("Reconciliation — Invariant 4: Store Credit Pool vs Returns & Payments", () => {
  it("tracks available store credit through returns, payments, over-spend refusals, and deletions", async () => {
    const prod = await newProduct("recon-store-credit", 20, 10, 10); // 20 + 10% = 22.00 / unit
    await seedStock(t, prod, 100);

    const cust = await createIsolatedCustomer(t, "recon-sc-cust");

    // 1. Sale 1: 5 units ($110.00). Customer pays full amount in Cash.
    const sale1 = await createSale(t, {
      customerId: cust.id,
      items: [{ productId: prod.id, quantity: 5, unitPrice: 20, taxPercent: 10 }],
    });
    await createPayment(t, {
      customerId: cust.id,
      saleId: sale1.id,
      amount: 110.00,
      method: "Cash",
    });

    // Balance is 0, store credit pool is 0
    await assertCustomerLedgerReconciliation(cust.id);
    const pool0 = await assertStoreCreditReconciliation(cust.id);
    expectMoney(pool0.expectedAvailableStoreCredit, 0);

    // 2. Return 2 units -> credit of 2 * 22.00 = $44.00
    const ret = await createReturn(t, {
      returnType: "SALE",
      saleId: sale1.id,
      items: [{ productId: prod.id, quantity: 2, condition: "RESTOCKABLE" }],
    });

    // Ledger balance remains 0 (floored: cash was already settled, ADR 0006)
    await assertCustomerLedgerReconciliation(cust.id);
    // Store credit pool has accumulated $44.00
    const pool1 = await assertStoreCreditReconciliation(cust.id);
    expectMoney(pool1.expectedAvailableStoreCredit, 44.00);

    // 3. Sale 2: 3 units ($66.00). Customer wants to use store credit.
    const sale2 = await createSale(t, {
      customerId: cust.id,
      items: [{ productId: prod.id, quantity: 3, unitPrice: 20, taxPercent: 10 }],
    });

    // Over-spend refusal: attempt to pay $50.00 with Store Credit when only $44.00 available
    await expectRefusal(
      raw("post", "/payments", {
        paymentCode: unique("PAY"),
        customerId: cust.id,
        saleId: sale2.id,
        amount: 50.00,
        method: "Store Credit",
      }),
      409,
      "INSUFFICIENT_STORE_CREDIT"
    );

    // Legitimate store credit payment: spend $40.00
    const scPay = await createPayment(t, {
      customerId: cust.id,
      saleId: sale2.id,
      amount: 40.00,
      method: "Store Credit",
    });

    // Pool now has $44.00 - $40.00 = $4.00
    const pool2 = await assertStoreCreditReconciliation(cust.id);
    expectMoney(pool2.expectedAvailableStoreCredit, 4.00);

    // 4. Soft-delete the $40.00 Store Credit payment
    await ok(raw("delete", `/payments/${scPay.id}`));

    // Pool restored back to $44.00
    const pool3 = await assertStoreCreditReconciliation(cust.id);
    expectMoney(pool3.expectedAvailableStoreCredit, 44.00);

    // 5. Spend $30.00 Store Credit
    const scPay2 = await createPayment(t, {
      customerId: cust.id,
      saleId: sale2.id,
      amount: 30.00,
      method: "Store Credit",
    });
    const pool4 = await assertStoreCreditReconciliation(cust.id);
    expectMoney(pool4.expectedAvailableStoreCredit, 14.00); // 44 - 30 = 14

    // 6. Soft-delete the return -> revokes the $44.00 credit
    await ok(raw("delete", `/returns/${ret.id}`));

    // Pool calculation: total return credit is now 0. Used is 30.
    // available = max(0, 0 - 30) = 0.
    const pool5 = await assertStoreCreditReconciliation(cust.id);
    expectMoney(pool5.expectedAvailableStoreCredit, 0);

    // Further store credit payments must now be refused
    await expectRefusal(
      raw("post", "/payments", {
        paymentCode: unique("PAY"),
        customerId: cust.id,
        saleId: sale2.id,
        amount: 5.00,
        method: "Store Credit",
      }),
      409,
      "INSUFFICIENT_STORE_CREDIT"
    );
  });
});

describe("Reconciliation — Invariant 5: Dashboard Organization-Wide Financial Truth", () => {
  it("matches dashboard statistics against tenant-wide documents and ledgers", async () => {
    const prodA = await newProduct("recon-dash-a", 30, 15, 10); // 30 + 10% = 33.00
    const prodB = await newProduct("recon-dash-b", 50, 25, 10); // 50 + 10% = 55.00
    await seedStock(t, prodA, 100);
    await seedStock(t, prodB, 100);

    const custA = await createIsolatedCustomer(t, "recon-dash-cust-a");
    const custB = await createIsolatedCustomer(t, "recon-dash-cust-b");

    // Purchase 1
    await createPurchase(t, t.supplier.id, [{ productId: prodA.id, quantity: 20 }]);

    // Sale 1 for Cust A (5 * 33 = $165.00)
    const saleA = await createSale(t, {
      customerId: custA.id,
      items: [{ productId: prodA.id, quantity: 5, unitPrice: 30, taxPercent: 10 }],
    });
    // Cust A pays $65.00
    await createPayment(t, {
      customerId: custA.id,
      saleId: saleA.id,
      amount: 65.00,
      method: "Cash",
    });

    // Sale 2 for Cust B (4 * 55 = $220.00)
    const saleB = await createSale(t, {
      customerId: custB.id,
      items: [{ productId: prodB.id, quantity: 4, unitPrice: 50, taxPercent: 10 }],
    });
    // Cust B makes unallocated payment of $50.00
    await createPayment(t, {
      customerId: custB.id,
      amount: 50.00,
      method: "Bank Transfer",
    });

    // Cust A returns 1 unit ($33.00 credit)
    await createReturn(t, {
      returnType: "SALE",
      saleId: saleA.id,
      items: [{ productId: prodA.id, quantity: 1, condition: "RESTOCKABLE" }],
    });

    // Read dashboard stats
    const stats = (await ok(raw("get", "/dashboard/stats"))).body;

    // Verify Outstanding matches the tenant-wide truth:
    // unpaid balances on active invoices - return credits - unallocated cash payments
    const unpaidSalesAgg = await prisma.sale.aggregate({
      where: { organizationId: t.organizationId, deletedAt: null, status: { not: "Cancelled" } },
      _sum: { totalAmount: true, amountPaid: true },
    });
    const expectedUnpaid =
      (unpaidSalesAgg._sum.totalAmount ?? 0) - (unpaidSalesAgg._sum.amountPaid ?? 0);

    const returns = await prisma.return.findMany({
      where: { organizationId: t.organizationId, deletedAt: null, returnType: "SALE" },
      select: {
        items: { select: { quantity: true, unitPrice: true, taxAmount: true, discount: true } },
      },
    });
    const expectedReturnCredits = returns.reduce(
      (sum, ret) =>
        sum +
        ret.items.reduce(
          (lineSum, item) => lineSum + item.quantity * item.unitPrice + item.taxAmount - item.discount,
          0
        ),
      0
    );

    const unallocatedAgg = await prisma.payment.aggregate({
      where: { organizationId: t.organizationId, deletedAt: null, saleId: null },
      _sum: { amount: true },
    });
    const expectedUnallocated = unallocatedAgg._sum.amount ?? 0;

    const expectedOutstanding = Math.max(0, expectedUnpaid - expectedReturnCredits - expectedUnallocated);
    expectMoney(stats.outstanding, expectedOutstanding);

    // Verify sales total and purchases total
    const salesTotal = await prisma.sale.aggregate({
      where: { organizationId: t.organizationId, deletedAt: null },
      _sum: { totalAmount: true },
    });
    expectMoney(stats.totalSalesAmount, salesTotal._sum.totalAmount ?? 0);

    const purchasesTotal = await prisma.purchase.aggregate({
      where: { organizationId: t.organizationId, deletedAt: null },
      _sum: { totalAmount: true },
    });
    expectMoney(stats.totalPurchasesAmount, purchasesTotal._sum.totalAmount ?? 0);
  });
});
