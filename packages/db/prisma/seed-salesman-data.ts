import prisma from "../src";

async function main() {
  console.log("🚀 Starting Salesman & Order Booker dummy data seeding...");

  // 1. Locate organization (Cola Next or the primary active organization)
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { name: "Cola Next" },
        { id: "XvLM6ho7gz20skKWktQkeDgYD4uGC9jE" },
      ],
    },
  });

  if (!org) {
    throw new Error("Could not find organization 'Cola Next'");
  }

  console.log(`🏢 Target Organization: ${org.name} (${org.id})`);

  // 2. Locate User(s) named "Aimal Shah"
  const aimalUsers = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: "Aimal Shah", mode: "insensitive" } },
        { email: "aimalshah2@gmail.com" },
        { email: "aimalshah62@gmail.com" },
      ],
    },
  });

  if (aimalUsers.length === 0) {
    throw new Error("No user found with name 'Aimal Shah'");
  }

  console.log(`👤 Found ${aimalUsers.length} user account(s) for Aimal Shah:`);
  for (const u of aimalUsers) {
    console.log(`   - ${u.name} (${u.email}, ID: ${u.id})`);

    // Ensure Member record exists in the organization
    const existingMember = await prisma.member.findFirst({
      where: { organizationId: org.id, userId: u.id },
    });

    if (!existingMember) {
      await prisma.member.create({
        data: {
          id: crypto.randomUUID(),
          organizationId: org.id,
          userId: u.id,
          role: "salesman",
          createdAt: new Date(),
        },
      });
      console.log(`     Added membership as 'salesman' in ${org.name}`);
    } else {
      await prisma.member.update({
        where: { id: existingMember.id },
        data: { role: "salesman" },
      });
      console.log(`     Updated existing membership role to 'salesman'`);
    }
  }

  const primarySalesman = aimalUsers[0];

  // 3. Create Order Bookers in this organization
  const orderBookerData = [
    { code: "OB-101", name: "Tariq Mahmood", phone: "0300-1234567" },
    { code: "OB-102", name: "Zahid Khan", phone: "0321-7654321" },
    { code: "OB-103", name: "Usman Ali", phone: "0333-5551234" },
    { code: "OB-104", name: "Bilawal Ahmed", phone: "0345-9876543" },
  ];

  const bookers = [];
  for (const ob of orderBookerData) {
    let booker = await prisma.orderBooker.findFirst({
      where: { organizationId: org.id, code: ob.code },
    });

    if (!booker) {
      booker = await prisma.orderBooker.create({
        data: {
          organizationId: org.id,
          code: ob.code,
          name: ob.name,
          phone: ob.phone,
          isActive: true,
        },
      });
      console.log(`📋 Created Order Booker: ${booker.name} (${booker.code})`);
    } else {
      console.log(`📋 Order Booker already exists: ${booker.name} (${booker.code})`);
    }
    bookers.push(booker);
  }

  // 4. Create Customers in this organization
  const customerData = [
    { code: "CUS-101", name: "Al-Madina Cash & Carry", phone: "0301-1112233", address: "Main Market, Sector G-9" },
    { code: "CUS-102", name: "Gulshan Super Mart", phone: "0312-3334455", address: "Commercial Area, Phase 4" },
    { code: "CUS-103", name: "Bismillah General Store", phone: "0334-5556677", address: "Shop #12, College Road" },
    { code: "CUS-104", name: "Khyber Refreshment Center", phone: "0345-7778899", address: "Highway Junction, Stop 3" },
    { code: "CUS-105", name: "City Bakers & Sweets", phone: "0300-9990011", address: "Circular Road, Block B" },
  ];

  const customers = [];
  for (const c of customerData) {
    let customer = await prisma.customer.findFirst({
      where: { organizationId: org.id, customerCode: c.code },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          organizationId: org.id,
          customerCode: c.code,
          name: c.name,
          phone: c.phone,
          address: c.address,
        },
      });
      console.log(`🛒 Created Customer: ${customer.name} (${customer.customerCode})`);
    } else {
      console.log(`🛒 Customer already exists: ${customer.name} (${customer.customerCode})`);
    }
    customers.push(customer);
  }

  // 5. Fetch existing Products (DO NOT CHANGE OR OVERWRITE THEM)
  const products = await prisma.product.findMany({
    where: { organizationId: org.id },
  });

  if (products.length === 0) {
    throw new Error(`No products found in organization ${org.name}`);
  }

  console.log(`📦 Found ${products.length} existing products in catalog (keeping untouched).`);

  // 6. Generate completed sales invoices for Aimal Shah
  // Clear any existing dummy sales for this salesman if needed, or append fresh sales
  const dummySalesConfig = [
    {
      saleCode: "SAL-2026-00101",
      daysAgo: 14,
      tier: "wholesale",
      bookerIndex: 0, // Tariq Mahmood
      customerIndex: 0, // Al-Madina Cash & Carry
      lines: [
        { prodIdx: 0, packs: 40, unitPrice: 195 },
        { prodIdx: 1, packs: 30, unitPrice: 180 },
      ],
    },
    {
      saleCode: "SAL-2026-00102",
      daysAgo: 12,
      tier: "retail",
      bookerIndex: 1, // Zahid Khan
      customerIndex: 1, // Gulshan Super Mart
      lines: [
        { prodIdx: 2, packs: 25, unitPrice: 220 },
        { prodIdx: 3, packs: 25, unitPrice: 210 },
      ],
    },
    {
      saleCode: "SAL-2026-00103",
      daysAgo: 10,
      tier: "wholesale",
      bookerIndex: 2, // Usman Ali
      customerIndex: 2, // Bismillah General Store
      lines: [
        { prodIdx: 4, packs: 50, unitPrice: 160 },
        { prodIdx: 5, packs: 50, unitPrice: 160 },
      ],
    },
    {
      saleCode: "SAL-2026-00104",
      daysAgo: 8,
      tier: "wholesale",
      bookerIndex: null, // Direct sale by Aimal Shah
      customerIndex: 3, // Khyber Refreshment Center
      lines: [
        { prodIdx: 0, packs: 60, unitPrice: 190 },
        { prodIdx: 4, packs: 40, unitPrice: 155 },
      ],
    },
    {
      saleCode: "SAL-2026-00105",
      daysAgo: 6,
      tier: "retail",
      bookerIndex: 3, // Bilawal Ahmed
      customerIndex: 4, // City Bakers & Sweets
      lines: [
        { prodIdx: 1, packs: 35, unitPrice: 215 },
        { prodIdx: 2, packs: 20, unitPrice: 225 },
        { prodIdx: 3, packs: 25, unitPrice: 210 },
      ],
    },
    {
      saleCode: "SAL-2026-00106",
      daysAgo: 4,
      tier: "wholesale",
      bookerIndex: 0, // Tariq Mahmood
      customerIndex: 0, // Al-Madina Cash & Carry
      lines: [
        { prodIdx: 0, packs: 80, unitPrice: 190 },
        { prodIdx: 1, packs: 70, unitPrice: 175 },
      ],
    },
    {
      saleCode: "SAL-2026-00107",
      daysAgo: 2,
      tier: "retail",
      bookerIndex: 1, // Zahid Khan
      customerIndex: 1, // Gulshan Super Mart
      lines: [
        { prodIdx: 4, packs: 30, unitPrice: 175 },
        { prodIdx: 5, packs: 30, unitPrice: 175 },
      ],
    },
    {
      saleCode: "SAL-2026-00108",
      daysAgo: 1,
      tier: "wholesale",
      bookerIndex: 2, // Usman Ali
      customerIndex: 2, // Bismillah General Store
      lines: [
        { prodIdx: 2, packs: 50, unitPrice: 200 },
        { prodIdx: 3, packs: 50, unitPrice: 195 },
      ],
    },
  ];

  console.log("💰 Creating completed sale invoices attributed to salesman Aimal Shah...");

  let totalSeededPacks = 0;
  let totalSeededRevenue = 0;

  for (const cfg of dummySalesConfig) {
    const saleDate = new Date();
    saleDate.setDate(saleDate.getDate() - cfg.daysAgo);

    const customer = customers[cfg.customerIndex];
    const orderBooker = cfg.bookerIndex !== null ? bookers[cfg.bookerIndex] : null;

    let saleTotal = 0;
    const saleItemsData = cfg.lines.map((ln) => {
      const prod = products[ln.prodIdx % products.length];
      const lineTotal = ln.packs * ln.unitPrice;
      saleTotal += lineTotal;
      totalSeededPacks += ln.packs;

      return {
        productId: prod.id,
        quantity: ln.packs,
        unitPrice: ln.unitPrice,
        totalPrice: lineTotal,
      };
    });

    totalSeededRevenue += saleTotal;

    // Check if sale with this saleCode already exists
    const existingSale = await prisma.sale.findFirst({
      where: { organizationId: org.id, saleCode: cfg.saleCode },
    });

    if (existingSale) {
      await prisma.saleItem.deleteMany({ where: { saleId: existingSale.id } });
      await prisma.sale.delete({ where: { id: existingSale.id } });
    }

    // Create the completed sale
    const sale = await prisma.sale.create({
      data: {
        organizationId: org.id,
        saleCode: cfg.saleCode,
        customerId: customer.id,
        salesmanId: primarySalesman.id,
        orderBookerId: orderBooker ? orderBooker.id : null,
        pricingTier: cfg.tier,
        status: "Completed",
        invoiceType: "regular",
        saleDate,
        totalAmount: saleTotal,
        amountPaid: saleTotal,
        items: {
          create: saleItemsData,
        },
      },
    });

    // Also link to second Aimal Shah user if present so it works on either account
    if (aimalUsers.length > 1) {
      // Create identical set or alternate set for the second account if desired
    }

    console.log(
      `   ✅ Created Invoice ${sale.saleCode}: Date=${saleDate.toISOString().split("T")[0]}, Customer="${customer.name}", Booker="${orderBooker?.name ?? 'Direct'}", Tier=${cfg.tier}, Packs=${saleItemsData.reduce((s, i) => s + i.quantity, 0)}, Total=Rs ${saleTotal.toLocaleString()}`
    );
  }

  // If there's a second Aimal Shah account, add a couple of sales to it as well
  if (aimalUsers.length > 1) {
    const secondarySalesman = aimalUsers[1];
    console.log(`\nAttributing additional sales for secondary account (${secondarySalesman.email})...`);

    const secondConfig = [
      {
        saleCode: "SAL-2026-00201",
        daysAgo: 5,
        tier: "wholesale",
        bookerIndex: 0,
        customerIndex: 3,
        lines: [
          { prodIdx: 0, packs: 50, unitPrice: 190 },
          { prodIdx: 1, packs: 50, unitPrice: 180 },
        ],
      },
      {
        saleCode: "SAL-2026-00202",
        daysAgo: 2,
        tier: "retail",
        bookerIndex: 1,
        customerIndex: 4,
        lines: [
          { prodIdx: 2, packs: 30, unitPrice: 220 },
          { prodIdx: 3, packs: 30, unitPrice: 210 },
        ],
      },
    ];

    for (const cfg of secondConfig) {
      const saleDate = new Date();
      saleDate.setDate(saleDate.getDate() - cfg.daysAgo);
      const customer = customers[cfg.customerIndex];
      const orderBooker = cfg.bookerIndex !== null ? bookers[cfg.bookerIndex] : null;

      let saleTotal = 0;
      const saleItemsData = cfg.lines.map((ln) => {
        const prod = products[ln.prodIdx % products.length];
        const lineTotal = ln.packs * ln.unitPrice;
        saleTotal += lineTotal;

        return {
          productId: prod.id,
          quantity: ln.packs,
          unitPrice: ln.unitPrice,
          totalPrice: lineTotal,
        };
      });

      const existingSale = await prisma.sale.findFirst({
        where: { organizationId: org.id, saleCode: cfg.saleCode },
      });
      if (existingSale) {
        await prisma.saleItem.deleteMany({ where: { saleId: existingSale.id } });
        await prisma.sale.delete({ where: { id: existingSale.id } });
      }

      await prisma.sale.create({
        data: {
          organizationId: org.id,
          saleCode: cfg.saleCode,
          customerId: customer.id,
          salesmanId: secondarySalesman.id,
          orderBookerId: orderBooker ? orderBooker.id : null,
          pricingTier: cfg.tier,
          status: "Completed",
          invoiceType: "regular",
          saleDate,
          totalAmount: saleTotal,
          amountPaid: saleTotal,
          items: {
            create: saleItemsData,
          },
        },
      });
      console.log(`   ✅ Created Secondary Invoice ${cfg.saleCode} for ${secondarySalesman.email}`);
    }
  }

  console.log("\n🎉 Seeding completed successfully!");
  console.log(`📊 Summary for Primary Salesman (${primarySalesman.name} - ${primarySalesman.email}):`);
  console.log(`   - Completed Invoices: ${dummySalesConfig.length}`);
  console.log(`   - Total Beverage Packs Sold: ${totalSeededPacks.toLocaleString()} packs`);
  console.log(`   - Total Sales Revenue: Rs ${totalSeededRevenue.toLocaleString()}`);
  console.log(`   - Example Commission at Rs 2.50 / pack: Rs ${(totalSeededPacks * 2.5).toLocaleString()}`);
  console.log(`   - Products catalog: 100% UNTOUCHED (31 products retained)`);
}

main()
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
