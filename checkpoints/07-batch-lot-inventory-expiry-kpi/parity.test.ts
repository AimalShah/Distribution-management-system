/**
 * Checkpoint 7 — Batch/Lot Inventory + Expiry KPI: Parity Test
 *
 * Scope:
 * 1. Schema assertions: StockBatch model, composite unique, SaleItem.batchId relation.
 * 2. Shared validation schemas: batchListQuerySchema and stockBatchCreateSchema.
 * 3. Express API routes: /api/inventory/batches, /api/inventory/batches/expiring, /api/inventory/batches/:id.
 * 4. Service contract: FEFO batch deductions, batch quantity tracking, and batch-level expiry reporting.
 * 5. Web UI: ExpiringSoonCard component, Batches table component, InventoryPage tab integration, Dashboard layout.
 * 6. Live DB tests (when database is available): Purchase creates StockBatch, Sale deducts using FEFO,
 *    and Expiry report reflects batch-level quantities.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import {
  batchListQuerySchema,
  stockBatchCreateSchema,
} from "@dms/shared";
import { createApp } from "../../apps/server/src/app";
import {
  hasDatabase,
  prisma,
  unique,
  ORGANIZATION_HEADER,
  USER_HEADER,
} from "../support/parity-db";
import { createPurchase } from "../../apps/server/src/services/purchase";
import { createSale, deleteSale } from "../../apps/server/src/services/sale";
import { createReturn, deleteReturn } from "../../apps/server/src/services/return";
import {
  getExpiringSoonBatches,
  getStockBatchById,
  listStockBatches,
} from "../../apps/server/src/services/batch";
import { getExpiryReport } from "../../apps/server/src/services/reports/inventory-report";

const root = path.resolve(__dirname, "../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);

  return fs.readFileSync(full, "utf-8");
};

describe("Checkpoint 7 — Batch/Lot Inventory (Contract & Static)", () => {
  it("declares StockBatch model with required relations and unique constraints", () => {
    const schema = read("packages/db/prisma/schema.prisma");

    expect(schema).toContain("model StockBatch {");
    expect(schema).toContain("batchNumber       String");
    expect(schema).toContain("expiryDate        DateTime?");
    expect(schema).toContain("quantityRemaining Int");
    expect(schema).toContain("quantityReceived  Int");
    expect(schema).toContain("unitCost          Float");
    expect(schema).toContain("@@unique([productId, batchNumber, organizationId])");
    expect(schema).toContain("@@map(\"stock_batches\")");

    // Relations on parent models
    expect(schema).toContain("batches       StockBatch[]");
    expect(schema).toContain("batch   StockBatch? @relation(fields: [batchId]");
  });

  it("exports batch query and creation validation schemas from @dms/shared", () => {
    // Valid query
    const validQuery = batchListQuerySchema.safeParse({
      page: "1",
      pageSize: "20",
      expiringWithinDays: "30",
      search: "BATCH-001",
    });

    expect(validQuery.success).toBe(true);

    // Valid create input
    const validCreate = stockBatchCreateSchema.safeParse({
      productId: "prod_1",
      batchNumber: "B-2026-01",
      quantity: 50,
      unitCost: 12.5,
    });

    expect(validCreate.success).toBe(true);

    // Negative quantity fails
    const invalidCreate = stockBatchCreateSchema.safeParse({
      productId: "prod_1",
      batchNumber: "B-2026-01",
      quantity: -5,
    });

    expect(invalidCreate.success).toBe(false);
  });

  it("mounts batch routes in apps/server/src/routes/inventory.ts", () => {
    const routesSrc = read("apps/server/src/routes/inventory.ts");
    expect(routesSrc).toMatch(/inventoryRouter\.get\(\s*["']\/batches["']/);
    expect(routesSrc).toMatch(/inventoryRouter\.get\(\s*["']\/batches\/expiring["']/);
    expect(routesSrc).toMatch(/inventoryRouter\.get\(\s*["']\/batches\/:id["']/);
  });

  it("implements ExpiringSoonCard and integrates into Dashboard", () => {
    const cardSrc = read("apps/web/src/components/dashboard/ExpiringSoonCard.tsx");
    const dashSrc = read("apps/web/src/pages/Dashboard.tsx");

    expect(cardSrc).toContain("Expiring Soon");
    expect(cardSrc).toContain("/inventory/batches/expiring");
    expect(cardSrc).toContain("batchNumber");
    expect(cardSrc).toContain("quantityRemaining");

    expect(dashSrc).toContain("ExpiringSoonCard");
    expect(dashSrc).toContain("<ExpiringSoonCard />");
  });

  it("implements Batches table and integrates into InventoryPage tabs", () => {
    const batchesSrc = read("apps/web/src/pages/inventory/Batches.tsx");
    const invSrc = read("apps/web/src/pages/InventoryPage.tsx");

    expect(batchesSrc).toContain("Stock Batches & Lots");
    expect(batchesSrc).toContain("/inventory/batches?");
    expect(batchesSrc).toContain("quantityRemaining");
    expect(batchesSrc).toContain("quantityReceived");
    expect(batchesSrc).toContain("formatDate");

    expect(invSrc).toContain("Batches");
    expect(invSrc).toContain('value="batches"');
    expect(invSrc).toContain("<Batches />");
  });
});

describe.skipIf(!hasDatabase)("Checkpoint 7 — Batch/Lot Inventory (Live Database)", () => {
  let orgId: string;
  let userId: string;
  let supplierId: string;
  let customerId: string;
  let categoryId: string;
  let brandId: string;
  let productId: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    app = createApp({ authMode: "header" });
    const at = new Date();

    // Create org
    const org = await prisma.organization.create({
      data: {
        id: unique("org"),
        name: unique("Batch Org"),
        slug: unique("batch-org").toLowerCase(),
        createdAt: at,
      },
    });

    orgId = org.id;

    // Create user
    const user = await prisma.user.create({
      data: {
        id: unique("usr"),
        name: "Batch Manager",
        email: `${unique("batch-mgr")}@example.test`.toLowerCase(),
        emailVerified: true,
        createdAt: at,
        updatedAt: at,
      },
    });

    userId = user.id;

    await prisma.member.create({
      data: {
        id: unique("mem"),
        organizationId: orgId,
        userId: userId,
        role: "adminRole",
        createdAt: at,
      },
    });

    // Create supplier
    const supplier = await prisma.supplier.create({
      data: {
        supplierCode: unique("SUPP"),
        contactPerson: "Contact Person",
        companyName: unique("Pharma Supply"),
        organizationId: orgId,
      },
    });

    supplierId = supplier.id;

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        customerCode: unique("CUST"),
        name: unique("City Hospital"),
        organizationId: orgId,
      },
    });

    customerId = customer.id;

    // Create category & brand
    const cat = await prisma.category.create({
      data: {
        name: unique("Pharmaceuticals"),
        organizationId: orgId,
      },
    });

    categoryId = cat.id;

    const brand = await prisma.brand.create({
      data: {
        name: unique("MediCorp"),
        categoryId: cat.id,
        organizationId: orgId,
      },
    });

    brandId = brand.id;

    // Create product
    const prod = await prisma.product.create({
      data: {
        productCode: unique("MED"),
        name: "Amoxicillin 500mg",
        categoryId: categoryId,
        brandId: brandId,
        unit: "box",
        unitPrice: 25.0,
        unitCost: 15.0,
        organizationId: orgId,
      },
    });

    productId = prod.id;
  });

  afterAll(async () => {
    if (orgId) {
      // Return lines reference products, and that foreign key refuses to
      // delete a product they still point at, so the returns go first.
      await prisma.returnItem.deleteMany({ where: { return: { organizationId: orgId } } });
      await prisma.return.deleteMany({ where: { organizationId: orgId } });
      await prisma.saleItem.deleteMany({ where: { product: { organizationId: orgId } } });
      await prisma.sale.deleteMany({ where: { organizationId: orgId } });
      await prisma.stockBatch.deleteMany({ where: { organizationId: orgId } });
      await prisma.purchaseItem.deleteMany({ where: { purchase: { organizationId: orgId } } });
      await prisma.purchase.deleteMany({ where: { organizationId: orgId } });
      await prisma.inventoryLog.deleteMany({ where: { product: { organizationId: orgId } } });
      await prisma.inventory.deleteMany({ where: { organizationId: orgId } });
      await prisma.product.deleteMany({ where: { organizationId: orgId } });
      await prisma.brand.deleteMany({ where: { organizationId: orgId } });
      await prisma.category.deleteMany({ where: { organizationId: orgId } });
      await prisma.customer.deleteMany({ where: { organizationId: orgId } });
      await prisma.supplier.deleteMany({ where: { organizationId: orgId } });
      await prisma.member.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }

    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it("creates StockBatch records when purchase items have batch numbers", async () => {
    const batch1Expiry = new Date();
    batch1Expiry.setDate(batch1Expiry.getDate() + 20); // Expires in 20 days (soon)

    const batch2Expiry = new Date();
    batch2Expiry.setDate(batch2Expiry.getDate() + 90); // Expires in 90 days

    await createPurchase(
      {
        purchaseCode: unique("PO-BATCH"),
        supplierId,
        purchaseDate: new Date(),
        status: "Completed",
        items: [
          {
            productId,
            quantity: 30,
            unitCost: 15.0,
            batchNumber: "LOT-EARLY-01",
            expiryDate: batch1Expiry,
          },
          {
            productId,
            quantity: 50,
            unitCost: 15.0,
            batchNumber: "LOT-LATE-02",
            expiryDate: batch2Expiry,
          },
        ],
      },
      orgId,
      userId
    );

    const batches = await listStockBatches(orgId, { productId });
    expect(batches.total).toBe(2);

    const early = batches.data.find((b) => b.batchNumber === "LOT-EARLY-01");
    const late = batches.data.find((b) => b.batchNumber === "LOT-LATE-02");

    expect(early).toBeDefined();
    expect(early?.quantityReceived).toBe(30);
    expect(early?.quantityRemaining).toBe(30);

    expect(late).toBeDefined();
    expect(late?.quantityReceived).toBe(50);
    expect(late?.quantityRemaining).toBe(50);
  });

  it("deducts stock from batches using FEFO (First Expired, First Out)", async () => {
    // Total on hand is 80 (30 from early batch, 50 from late batch).
    // Sell 40 units:
    // All 30 units of LOT-EARLY-01 should be consumed first,
    // plus 10 units from LOT-LATE-02, leaving 40 in LOT-LATE-02.
    await createSale(
      {
        saleCode: unique("INV-FEFO"),
        customerId,
        saleDate: new Date(),
        status: "Completed",
        items: [
          {
            productId,
            quantity: 40,
            unitPrice: 25.0,
          },
        ],
      },
      orgId,
      userId
    );

    const batches = await listStockBatches(orgId, { productId });
    const early = batches.data.find((b) => b.batchNumber === "LOT-EARLY-01")!;
    const late = batches.data.find((b) => b.batchNumber === "LOT-LATE-02")!;

    expect(early.quantityRemaining).toBe(0);
    expect(late.quantityRemaining).toBe(40);
  });

  it("getExpiringSoonBatches returns batches expiring within threshold", async () => {
    const expiringSoon = await getExpiringSoonBatches(orgId, 30, 5);
    // LOT-EARLY-01 has 0 remaining, so only batches with quantityRemaining > 0 are considered.
    // If we add another batch with 10 units expiring in 15 days:
    const urgentExpiry = new Date();
    urgentExpiry.setDate(urgentExpiry.getDate() + 15);

    await createPurchase(
      {
        purchaseCode: unique("PO-URGENT"),
        supplierId,
        purchaseDate: new Date(),
        status: "Completed",
        items: [
          {
            productId,
            quantity: 10,
            unitCost: 15.0,
            batchNumber: "LOT-URGENT-03",
            expiryDate: urgentExpiry,
          },
        ],
      },
      orgId,
      userId
    );

    const updatedExpiring = await getExpiringSoonBatches(orgId, 30, 5);
    expect(updatedExpiring.length).toBeGreaterThanOrEqual(1);

    const urgent = updatedExpiring.find((b) => b.batchNumber === "LOT-URGENT-03");
    expect(urgent).toBeDefined();
    expect(urgent?.quantityRemaining).toBe(10);
    expect(urgent?.daysUntilExpiry).toBeLessThanOrEqual(15);
  });

  it("serves batch endpoints over HTTP", async () => {
    const res = await request(app)
      .get("/api/inventory/batches")
      .set(ORGANIZATION_HEADER, orgId)
      .set(USER_HEADER, userId);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("total");
    expect(res.body.total).toBeGreaterThanOrEqual(2);

    const expiringRes = await request(app)
      .get("/api/inventory/batches/expiring?days=30")
      .set(ORGANIZATION_HEADER, orgId)
      .set(USER_HEADER, userId);

    expect(expiringRes.status).toBe(200);
    expect(Array.isArray(expiringRes.body)).toBe(true);
  });

  it("getExpiryReport includes batch-level remaining quantity", async () => {
    const report = await getExpiryReport(orgId, { daysUntilExpiry: 180 });
    expect(report.length).toBeGreaterThanOrEqual(1);

    const item = report.find((r) => r.batchNumber === "LOT-URGENT-03");
    expect(item).toBeDefined();
    expect(item?.quantityRemaining).toBe(10);
    expect(item?.purchasedQuantity).toBe(10);
  });

  it("moves the batches when a return moves the stock", async () => {
    const fefoSale = await prisma.sale.findFirst({
      where: { organizationId: orgId },
      select: { id: true },
    });

    expect(fefoSale).not.toBeNull();

    // A SALE return hands 5 units back: they land in the lots that are short
    // of what they received — latest expiry first, the reverse of FEFO.
    const created = await createReturn(
      {
        returnCode: unique("RET-BATCH"),
        returnType: "SALE",
        saleId: fefoSale!.id,
        returnDate: new Date(),
        reason: "Customer handed 5 boxes back",
        items: [{ productId, quantity: 5, unitPrice: 25.0, taxAmount: 0, discount: 0 }],
      },
      orgId,
      userId
    );

    const afterCreate = await listStockBatches(orgId, { productId });
    const lateAfterCreate = afterCreate.data.find((b) => b.batchNumber === "LOT-LATE-02");
    const earlyAfterCreate = afterCreate.data.find((b) => b.batchNumber === "LOT-EARLY-01");
    expect(lateAfterCreate?.quantityRemaining).toBe(45);
    expect(earlyAfterCreate?.quantityRemaining).toBe(0);

    // Deleting the return takes those 5 units back out: FEFO reaches for the
    // lot nearest expiry that still has stock — LOT-URGENT-03.
    await deleteReturn(created.id, orgId, userId);

    const afterDelete = await listStockBatches(orgId, { productId });
    const lateAfterDelete = afterDelete.data.find((b) => b.batchNumber === "LOT-LATE-02");
    const urgentAfterDelete = afterDelete.data.find((b) => b.batchNumber === "LOT-URGENT-03");
    expect(lateAfterDelete?.quantityRemaining).toBe(45);
    expect(urgentAfterDelete?.quantityRemaining).toBe(5);
  });

  it("restores the batches when the sale they were drawn from is deleted", async () => {
    const fefoSale = await prisma.sale.findFirst({
      where: { organizationId: orgId },
      include: { items: { select: { batchId: true } } },
    });

    expect(fefoSale).not.toBeNull();

    const batches = await listStockBatches(orgId, { productId });
    const early = batches.data.find((b) => b.batchNumber === "LOT-EARLY-01");

    // The sale line names the lot its units were drawn from (FEFO).
    expect(fefoSale!.items[0]?.batchId).toBe(early?.id);

    // The return above was soft-deleted, so nothing is left to block this.
    await deleteSale(fefoSale!.id, orgId, userId);

    const restored = await listStockBatches(orgId, { productId });
    const earlyRestored = restored.data.find((b) => b.batchNumber === "LOT-EARLY-01");
    const lateRestored = restored.data.find((b) => b.batchNumber === "LOT-LATE-02");
    const urgentRestored = restored.data.find((b) => b.batchNumber === "LOT-URGENT-03");
    expect(earlyRestored?.quantityRemaining).toBe(30);
    expect(lateRestored?.quantityRemaining).toBe(50);
    expect(urgentRestored?.quantityRemaining).toBe(10);
  });
});
