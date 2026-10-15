import "./load-env";
import prisma from "../src/client";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function main() {
  console.log("🔄 Updating stock batches with expired and expiring-soon dates...");

  const organization = await prisma.organization.findFirst();
  if (!organization) {
    throw new Error("No organization found");
  }
  const orgId = organization.id;
  const now = Date.now();

  // 1. Expired batches (past dates, quantity > 0)
  // 30 batches expired between 2 and 90 days ago
  const expiredOffsets = [
    2, 3, 5, 7, 9, 12, 14, 16, 18, 21,
    24, 27, 30, 33, 36, 40, 45, 50, 55, 60,
    65, 70, 75, 80, 85, 90, 4, 8, 11, 15
  ];

  console.log(`Setting ${expiredOffsets.length} batches as EXPIRED...`);
  for (let idx = 0; idx < expiredOffsets.length; idx++) {
    const batchId = `batch_stress_${idx + 1}`;
    const piId = `pi_stress_${idx + 1}`;
    const daysAgo = expiredOffsets[idx];
    const expiryDate = new Date(now - daysAgo * MS_PER_DAY);

    await prisma.stockBatch.updateMany({
      where: { id: batchId, organizationId: orgId },
      data: {
        expiryDate,
        quantityRemaining: 15 + (idx % 30),
      },
    });

    await prisma.purchaseItem.updateMany({
      where: { id: piId },
      data: { expiryDate },
    });
  }

  // 2. Expiring soon batches (1 to 29 days ahead, quantity > 0)
  // 30 batches expiring within the 30-day window
  const expiringOffsets = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30
  ];

  console.log(`Setting ${expiringOffsets.length} batches as EXPIRING SOON (< 30 days)...`);
  for (let idx = 0; idx < expiringOffsets.length; idx++) {
    const batchId = `batch_stress_${idx + 31}`;
    const piId = `pi_stress_${idx + 31}`;
    const daysAhead = expiringOffsets[idx];
    const expiryDate = new Date(now + daysAhead * MS_PER_DAY);

    await prisma.stockBatch.updateMany({
      where: { id: batchId, organizationId: orgId },
      data: {
        expiryDate,
        quantityRemaining: 20 + (idx % 25),
      },
    });

    await prisma.purchaseItem.updateMany({
      where: { id: piId },
      data: { expiryDate },
    });
  }

  // 3. Give friendly, realistic product names to the top batches so they look great on the dashboard
  const friendlyNames: Record<string, { name: string; unit: string }> = {
    prod_stress_1: { name: "Whole Milk 3.5% (1L Bottle)", unit: "bottle" },
    prod_stress_2: { name: "Artisan Sourdough Loaf 500g", unit: "piece" },
    prod_stress_3: { name: "Greek Style Natural Yogurt 450g", unit: "pack" },
    prod_stress_4: { name: "Fresh Strawberry Punnet 250g", unit: "box" },
    prod_stress_5: { name: "Free Range Large Eggs (Dozen)", unit: "carton" },
    prod_stress_31: { name: "Fresh Orange Juice 1L", unit: "bottle" },
    prod_stress_32: { name: "Cheddar Cheese Block 400g", unit: "piece" },
    prod_stress_33: { name: "Organic Baby Spinach 200g", unit: "pack" },
    prod_stress_34: { name: "Amoxicillin 250mg Suspension", unit: "bottle" },
    prod_stress_35: { name: "Cold Brew Coffee Concentrate", unit: "bottle" },
  };

  for (const [prodId, info] of Object.entries(friendlyNames)) {
    await prisma.product.updateMany({
      where: { id: prodId, organizationId: orgId },
      data: { name: info.name, unit: info.unit },
    });
  }

  // Summary counts
  const nowDate = new Date();
  const threshold30d = new Date(now + 30 * MS_PER_DAY);

  const [expiredCount, expiringSoonCount, totalBatches] = await Promise.all([
    prisma.stockBatch.count({
      where: {
        organizationId: orgId,
        quantityRemaining: { gt: 0 },
        expiryDate: { not: null, lt: nowDate },
      },
    }),
    prisma.stockBatch.count({
      where: {
        organizationId: orgId,
        quantityRemaining: { gt: 0 },
        expiryDate: { not: null, gte: nowDate, lte: threshold30d },
      },
    }),
    prisma.stockBatch.count({
      where: { organizationId: orgId },
    }),
  ]);

  console.log("✅ Batch update complete!");
  console.log(`   Total Batches: ${totalBatches}`);
  console.log(`   Expired Active Batches (expiry < now): ${expiredCount}`);
  console.log(`   Expiring Soon Active Batches (now <= expiry <= 30d): ${expiringSoonCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
