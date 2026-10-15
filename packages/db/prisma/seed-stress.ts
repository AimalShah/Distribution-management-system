// prisma/seed-stress.ts
// Stress-test seeder: seeds 30,000 entries across all primary entities
// to stress-test pagination, search, sorting, filtering, and database performance.
import "./load-env";
import prisma from "../src/client";

const COUNT = parseInt(process.env.STRESS_COUNT || "30000", 10);
const BATCH_SIZE = 5000;

const CITIES = [
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
  "Philadelphia", "San Antonio", "San Diego", "Dallas", "Austin",
  "San Jose", "Seattle", "Denver", "Boston", "Miami"
];

const UNITS = ["box", "piece", "case", "pack", "carton", "unit"];
const PAYMENT_METHODS = ["Bank Transfer", "Cash", "Cheque", "Mobile Wallet", "Other"];

function randomDate(daysAgoMin: number, daysAgoMax: number): string {
  const daysAgo = daysAgoMin + Math.random() * (daysAgoMax - daysAgoMin);
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function futureDate(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
}

async function insertBatch(table: string, columns: string[], rows: string[][]) {
  if (rows.length === 0) return;
  const values = rows.map((r) => `(${r.join(",")})`).join(",");
  const sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(",")}) VALUES ${values}`;
  await prisma.$executeRawUnsafe(sql);
}

export async function seedStress() {
  console.log(`🚀 Starting high-volume stress seeding (${COUNT.toLocaleString()} entries per entity)...`);
  const totalStart = Date.now();

  const organization = await prisma.organization.findFirst();
  if (!organization) {
    throw new Error("No organization found. Please run owner seed first.");
  }
  const orgId = organization.id;

  const owner = await prisma.user.findFirst({ where: { email: "owner@test.com" } });
  if (!owner) {
    throw new Error("No owner user found. Please run owner seed first.");
  }
  const ownerId = owner.id;

  // 1. Categories & Brands (100 each for clean distribution)
  console.log("📦 [1/13] Seeding 100 Categories and 100 Brands...");
  const catRows: string[][] = [];
  const brandRows: string[][] = [];
  const now = new Date().toISOString();

  for (let i = 1; i <= 100; i++) {
    catRows.push([
      `'cat_stress_${i}'`,
      `'Category ${i}'`,
      `'${orgId}'`,
      `'CAT${i}'`,
      `'Stress testing category ${i}'`,
      `'${now}'`,
      `'${now}'`,
    ]);

    brandRows.push([
      `'brand_stress_${i}'`,
      `'Brand ${i}'`,
      `'${orgId}'`,
      `'cat_stress_${i}'`,
      `'BRD${i}'`,
      `'Stress testing brand ${i}'`,
      `'${now}'`,
      `'${now}'`,
    ]);
  }

  // Insert or ignore categories & brands
  for (const r of catRows) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "category" ("id", "name", "organizationId", "shortCode", "description", "createdAt", "updatedAt")
       VALUES (${r.join(",")}) ON CONFLICT ("name", "organizationId") DO NOTHING`
    );
  }
  for (const r of brandRows) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "brand" ("id", "name", "organizationId", "categoryId", "shortCode", "description", "createdAt", "updatedAt")
       VALUES (${r.join(",")}) ON CONFLICT ("name", "categoryId", "organizationId") DO NOTHING`
    );
  }

  // 2. Suppliers (COUNT)
  console.log(`🏭 [2/13] Seeding ${COUNT.toLocaleString()} Suppliers...`);
  const suppCols = [
    "id", "supplierCode", "organizationId", "contactPerson", "companyName",
    "email", "phone", "address", "city", "isActive", "createdAt", "updatedAt"
  ];
  for (let offset = 1; offset <= COUNT; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE - 1, COUNT);
    const rows: string[][] = [];
    for (let i = offset; i <= end; i++) {
      const code = `SUPP-${String(i).padStart(6, "0")}`;
      const city = CITIES[i % CITIES.length];
      const d = randomDate(30, 365);
      rows.push([
        `'supp_stress_${i}'`,
        `'${code}'`,
        `'${orgId}'`,
        `'Contact Person ${i}'`,
        `'Global Supplier ${i} Logistics'`,
        `'supplier${i}@supplynet.com'`,
        `'+1-555-${String(i % 10000).padStart(4, "0")}'`,
        `'${(i * 17) % 9999 + 1} Industrial Parkway'`,
        `'${city}'`,
        "true",
        `'${d}'`,
        `'${d}'`
      ]);
    }
    await insertBatch("supplier", suppCols, rows);
    console.log(`   Suppliers: ${end.toLocaleString()} / ${COUNT.toLocaleString()} done`);
  }

  // 3. Customers (COUNT)
  console.log(`👥 [3/13] Seeding ${COUNT.toLocaleString()} Customers...`);
  const custCols = [
    "id", "customerCode", "organizationId", "name", "email", "phone",
    "address", "city", "creditLimit", "creditTermDays", "isActive", "createdAt", "updatedAt"
  ];
  for (let offset = 1; offset <= COUNT; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE - 1, COUNT);
    const rows: string[][] = [];
    for (let i = offset; i <= end; i++) {
      const code = `CUST-${String(i).padStart(6, "0")}`;
      const city = CITIES[(i + 3) % CITIES.length];
      const creditLimit = 5000 + (i % 25) * 1000;
      const creditTerms = i % 3 === 0 ? 15 : i % 3 === 1 ? 30 : 60;
      const d = randomDate(30, 365);
      rows.push([
        `'cust_stress_${i}'`,
        `'${code}'`,
        `'${orgId}'`,
        `'Enterprise Customer ${i}'`,
        `'customer${i}@enterprisecorp.com'`,
        `'+1-555-${String((i + 3000) % 10000).padStart(4, "0")}'`,
        `'${(i * 23) % 9999 + 1} Commercial Avenue'`,
        `'${city}'`,
        `${creditLimit}`,
        `${creditTerms}`,
        "true",
        `'${d}'`,
        `'${d}'`
      ]);
    }
    await insertBatch("customer", custCols, rows);
    console.log(`   Customers: ${end.toLocaleString()} / ${COUNT.toLocaleString()} done`);
  }

  // 4. Products (COUNT)
  console.log(`🏷️  [4/13] Seeding ${COUNT.toLocaleString()} Products...`);
  const prodCols = [
    "id", "productCode", "organizationId", "name", "description",
    "categoryId", "brandId", "unit", "unitPrice", "unitCost",
    "isActive", "gstApplicable", "gstRate", "createdAt", "updatedAt"
  ];
  for (let offset = 1; offset <= COUNT; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE - 1, COUNT);
    const rows: string[][] = [];
    for (let i = offset; i <= end; i++) {
      const code = `PROD-${String(i).padStart(6, "0")}`;
      const catId = `cat_stress_${((i - 1) % 100) + 1}`;
      const brandId = `brand_stress_${((i - 1) % 100) + 1}`;
      const unit = UNITS[i % UNITS.length];
      const unitPrice = (20 + (i % 480)).toFixed(2);
      const unitCost = ((20 + (i % 480)) * 0.65).toFixed(2);
      const gstRate = i % 2 === 0 ? 18.0 : 12.0;
      const d = randomDate(60, 365);
      rows.push([
        `'prod_stress_${i}'`,
        `'${code}'`,
        `'${orgId}'`,
        `'Distribution Item ${i} SKU'`,
        `'Stress testing product line item ${i}'`,
        `'${catId}'`,
        `'${brandId}'`,
        `'${unit}'`,
        `${unitPrice}`,
        `${unitCost}`,
        "true",
        "true",
        `${gstRate}`,
        `'${d}'`,
        `'${d}'`
      ]);
    }
    await insertBatch("products", prodCols, rows);
    console.log(`   Products: ${end.toLocaleString()} / ${COUNT.toLocaleString()} done`);
  }

  // 5. Inventory (COUNT)
  console.log(`📊 [5/13] Seeding ${COUNT.toLocaleString()} Inventory Records...`);
  const invCols = [
    "id", "productId", "organizationId", "quantityOnHand", "quantityReserved",
    "reorderLevel", "maxStockLevel", "createdAt", "updatedAt"
  ];
  for (let offset = 1; offset <= COUNT; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE - 1, COUNT);
    const rows: string[][] = [];
    for (let i = offset; i <= end; i++) {
      const onHand = 50 + ((i * 13) % 450);
      const reserved = i % 12;
      const d = randomDate(30, 365);
      rows.push([
        `'inv_stress_${i}'`,
        `'prod_stress_${i}'`,
        `'${orgId}'`,
        `${onHand}`,
        `${reserved}`,
        "25",
        "1000",
        `'${d}'`,
        `'${d}'`
      ]);
    }
    await insertBatch("inventory", invCols, rows);
    console.log(`   Inventory: ${end.toLocaleString()} / ${COUNT.toLocaleString()} done`);
  }

  // 6. Purchases (COUNT)
  console.log(`🛒 [6/13] Seeding ${COUNT.toLocaleString()} Purchases...`);
  const purchCols = [
    "id", "purchaseCode", "organizationId", "supplierId", "totalAmount",
    "taxAmount", "discount", "status", "purchaseDate", "createdAt", "updatedAt"
  ];
  for (let offset = 1; offset <= COUNT; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE - 1, COUNT);
    const rows: string[][] = [];
    for (let i = offset; i <= end; i++) {
      const code = `PO-${String(i).padStart(6, "0")}`;
      const suppId = `supp_stress_${((i - 1) % COUNT) + 1}`;
      const total = 1000 + (i % 2000);
      const tax = (total * 0.18).toFixed(2);
      const status = i % 6 === 0 ? "Pending" : "Completed";
      const d = randomDate(60, 365);
      rows.push([
        `'purch_stress_${i}'`,
        `'${code}'`,
        `'${orgId}'`,
        `'${suppId}'`,
        `${total}`,
        `${tax}`,
        "0",
        `'${status}'`,
        `'${d}'`,
        `'${d}'`,
        `'${d}'`
      ]);
    }
    await insertBatch("purchases", purchCols, rows);
    console.log(`   Purchases: ${end.toLocaleString()} / ${COUNT.toLocaleString()} done`);
  }

  // 7. Purchase Items (COUNT)
  console.log(`📋 [7/13] Seeding ${COUNT.toLocaleString()} Purchase Items...`);
  const piCols = [
    "id", "purchaseId", "productId", "quantity", "unitCost",
    "totalCost", "batchNumber", "expiryDate", "taxPercent", "discount"
  ];
  for (let offset = 1; offset <= COUNT; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE - 1, COUNT);
    const rows: string[][] = [];
    for (let i = offset; i <= end; i++) {
      const batchNo = `BATCH-${String(i).padStart(6, "0")}`;
      const expiry =
        i <= 30
          ? randomDate(2, 60)
          : i <= 60
            ? futureDate(1 + (i - 30))
            : futureDate(180 + (i % 365));
      rows.push([
        `'pi_stress_${i}'`,
        `'purch_stress_${i}'`,
        `'prod_stress_${i}'`,
        "50",
        "25.00",
        "1250.00",
        `'${batchNo}'`,
        `'${expiry}'`,
        "18.0",
        "0.0"
      ]);
    }
    await insertBatch("purchase_items", piCols, rows);
    console.log(`   Purchase Items: ${end.toLocaleString()} / ${COUNT.toLocaleString()} done`);
  }

  // 8. Stock Batches (COUNT)
  console.log(`📦 [8/13] Seeding ${COUNT.toLocaleString()} Stock Batches...`);
  const batchCols = [
    "id", "productId", "organizationId", "batchNumber", "expiryDate",
    "quantityRemaining", "quantityReceived", "unitCost", "purchaseItemId",
    "receivedAt", "createdAt", "updatedAt"
  ];
  for (let offset = 1; offset <= COUNT; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE - 1, COUNT);
    const rows: string[][] = [];
    for (let i = offset; i <= end; i++) {
      const batchNo = `BATCH-${String(i).padStart(6, "0")}`;
      const expiry =
        i <= 30
          ? randomDate(2, 60)
          : i <= 60
            ? futureDate(1 + (i - 30))
            : futureDate(180 + (i % 365));
      const d = randomDate(60, 365);
      rows.push([
        `'batch_stress_${i}'`,
        `'prod_stress_${i}'`,
        `'${orgId}'`,
        `'${batchNo}'`,
        `'${expiry}'`,
        "45",
        "50",
        "25.00",
        `'pi_stress_${i}'`,
        `'${d}'`,
        `'${d}'`,
        `'${d}'`
      ]);
    }
    await insertBatch("stock_batches", batchCols, rows);
    console.log(`   Stock Batches: ${end.toLocaleString()} / ${COUNT.toLocaleString()} done`);
  }

  // 9. Sales (COUNT)
  console.log(`💰 [9/13] Seeding ${COUNT.toLocaleString()} Sales Invoices...`);
  const saleCols = [
    "id", "saleCode", "customerId", "organizationId", "totalAmount",
    "taxAmount", "discount", "status", "invoiceType", "isInterState",
    "cgstAmount", "sgstAmount", "igstAmount", "saleDate", "createdAt",
    "updatedAt", "dueDate", "amountPaid"
  ];
  for (let offset = 1; offset <= COUNT; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE - 1, COUNT);
    const rows: string[][] = [];
    for (let i = offset; i <= end; i++) {
      const code = `INV-${String(i).padStart(6, "0")}`;
      const custId = `cust_stress_${((i - 1) % COUNT) + 1}`;
      const total = 500 + (i % 1500);
      const tax = (total * 0.18).toFixed(2);
      const cgst = (total * 0.09).toFixed(2);
      const sgst = (total * 0.09).toFixed(2);
      const isPending = i % 5 === 0;
      const status = isPending ? "Pending" : "Completed";
      const paid = isPending ? 0 : total;
      const d = randomDate(10, 300);
      const due = futureDate(30);
      rows.push([
        `'sale_stress_${i}'`,
        `'${code}'`,
        `'${custId}'`,
        `'${orgId}'`,
        `${total}`,
        `${tax}`,
        "0",
        `'${status}'`,
        "'regular'",
        "false",
        `${cgst}`,
        `${sgst}`,
        "0",
        `'${d}'`,
        `'${d}'`,
        `'${d}'`,
        `'${due}'`,
        `${paid}`
      ]);
    }
    await insertBatch("sales", saleCols, rows);
    console.log(`   Sales Invoices: ${end.toLocaleString()} / ${COUNT.toLocaleString()} done`);
  }

  // 10. Sale Items (COUNT)
  console.log(`🧾 [10/13] Seeding ${COUNT.toLocaleString()} Sale Items...`);
  const siCols = [
    "id", "saleId", "productId", "quantity", "unitPrice", "totalPrice",
    "taxPercent", "discount", "batchId", "cgstRate", "sgstRate", "igstRate",
    "cgstAmount", "sgstAmount", "igstAmount"
  ];
  for (let offset = 1; offset <= COUNT; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE - 1, COUNT);
    const rows: string[][] = [];
    for (let i = offset; i <= end; i++) {
      rows.push([
        `'si_stress_${i}'`,
        `'sale_stress_${i}'`,
        `'prod_stress_${i}'`,
        "5",
        "100.00",
        "500.00",
        "18.0",
        "0.0",
        `'batch_stress_${i}'`,
        "9.0",
        "9.0",
        "0.0",
        "45.0",
        "45.0",
        "0.0"
      ]);
    }
    await insertBatch("sale_items", siCols, rows);
    console.log(`   Sale Items: ${end.toLocaleString()} / ${COUNT.toLocaleString()} done`);
  }

  // 11. Payments (COUNT)
  console.log(`💳 [11/13] Seeding ${COUNT.toLocaleString()} Payments...`);
  const payCols = [
    "id", "paymentCode", "organizationId", "customerId", "saleId",
    "amount", "method", "reference", "note", "paidAt", "userId",
    "createdAt", "updatedAt"
  ];
  for (let offset = 1; offset <= COUNT; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE - 1, COUNT);
    const rows: string[][] = [];
    for (let i = offset; i <= end; i++) {
      const code = `PAY-${String(i).padStart(6, "0")}`;
      const custId = `cust_stress_${((i - 1) % COUNT) + 1}`;
      const method = PAYMENT_METHODS[i % PAYMENT_METHODS.length];
      const d = randomDate(5, 280);
      rows.push([
        `'pay_stress_${i}'`,
        `'${code}'`,
        `'${orgId}'`,
        `'${custId}'`,
        `'sale_stress_${i}'`,
        "500.00",
        `'${method}'`,
        `'REF-${String(i).padStart(8, "0")}'`,
        `'Payment received for stress test invoice ${i}'`,
        `'${d}'`,
        `'${ownerId}'`,
        `'${d}'`,
        `'${d}'`
      ]);
    }
    await insertBatch("payments", payCols, rows);
    console.log(`   Payments: ${end.toLocaleString()} / ${COUNT.toLocaleString()} done`);
  }

  // 12. Returns & Return Items (COUNT each)
  console.log(`🔄 [12/13] Seeding ${COUNT.toLocaleString()} Returns & Return Items...`);
  const retCols = [
    "id", "returnCode", "organizationId", "returnType", "returnDate",
    "reason", "userId", "createdAt", "updatedAt", "saleId"
  ];
  const riCols = [
    "id", "returnId", "productId", "quantity", "taxAmount", "discount",
    "unitPrice", "note", "condition", "reason"
  ];
  for (let offset = 1; offset <= COUNT; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE - 1, COUNT);
    const retRows: string[][] = [];
    const riRows: string[][] = [];
    for (let i = offset; i <= end; i++) {
      const code = `RET-${String(i).padStart(6, "0")}`;
      const d = randomDate(5, 200);
      retRows.push([
        `'ret_stress_${i}'`,
        `'${code}'`,
        `'${orgId}'`,
        "'SALE'::\"ReturnType\"",
        `'${d}'`,
        `'Customer stress test return line ${i}'`,
        `'${ownerId}'`,
        `'${d}'`,
        `'${d}'`,
        `'sale_stress_${i}'`
      ]);

      riRows.push([
        `'ri_stress_${i}'`,
        `'ret_stress_${i}'`,
        `'prod_stress_${i}'`,
        "1",
        "18.0",
        "0.0",
        "100.0",
        "'Inspected & verified'",
        "'RESTOCKABLE'::\"ReturnCondition\"",
        "'Surplus order returned'"
      ]);
    }
    await insertBatch("returns", retCols, retRows);
    await insertBatch("return_items", riCols, riRows);
    console.log(`   Returns & Return Items: ${end.toLocaleString()} / ${COUNT.toLocaleString()} done`);
  }

  // 13. Inventory Logs (COUNT)
  console.log(`📝 [13/13] Seeding ${COUNT.toLocaleString()} Inventory Logs...`);
  const logCols = [
    "id", "inventoryId", "productId", "userId", "movementType",
    "quantity", "previousQty", "newQty", "reason", "reference",
    "createdAt", "updatedAt"
  ];
  for (let offset = 1; offset <= COUNT; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE - 1, COUNT);
    const rows: string[][] = [];
    for (let i = offset; i <= end; i++) {
      const d = randomDate(10, 350);
      rows.push([
        `'inv_log_stress_${i}'`,
        `'inv_stress_${i}'`,
        `'prod_stress_${i}'`,
        `'${ownerId}'`,
        "'IN'::\"InventoryMovement\"",
        "50",
        "0",
        "50",
        `'Initial warehouse receipt batch ${i}'`,
        `'PO-${String(i).padStart(6, "0")}'`,
        `'${d}'`,
        `'${d}'`
      ]);
    }
    await insertBatch("inventory_logs", logCols, rows);
    console.log(`   Inventory Logs: ${end.toLocaleString()} / ${COUNT.toLocaleString()} done`);
  }

  const durationSec = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log(`\n🎉 High-volume stress seeding finished in ${durationSec}s!`);
  console.log("📊 Summary of seeded records:");
  console.log(`   - Categories:      100`);
  console.log(`   - Brands:          100`);
  console.log(`   - Suppliers:       ${COUNT.toLocaleString()}`);
  console.log(`   - Customers:       ${COUNT.toLocaleString()}`);
  console.log(`   - Products:        ${COUNT.toLocaleString()}`);
  console.log(`   - Inventory:       ${COUNT.toLocaleString()}`);
  console.log(`   - Purchases:       ${COUNT.toLocaleString()}`);
  console.log(`   - Purchase Items:  ${COUNT.toLocaleString()}`);
  console.log(`   - Stock Batches:   ${COUNT.toLocaleString()}`);
  console.log(`   - Sales Invoices:  ${COUNT.toLocaleString()}`);
  console.log(`   - Sale Items:      ${COUNT.toLocaleString()}`);
  console.log(`   - Payments:        ${COUNT.toLocaleString()}`);
  console.log(`   - Returns:         ${COUNT.toLocaleString()}`);
  console.log(`   - Return Items:    ${COUNT.toLocaleString()}`);
  console.log(`   - Inventory Logs:  ${COUNT.toLocaleString()}`);
  console.log(`   Total New Records: ${(COUNT * 12 + 200).toLocaleString()}`);
}

seedStress()
  .catch((e) => {
    console.error("❌ Error during stress seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("🔌 Database connection closed");
  });
