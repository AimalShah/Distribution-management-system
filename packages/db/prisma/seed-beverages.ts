import "./load-env";
import prisma from "../src/client";
import { assertLocalDatabase } from "./db-target";

export interface BeverageProductDef {
  name: string;
  code: string;
  brandCode: string;
  brandName: string;
  size: string;
  packaging: "Bottle" | "Can";
  description: string;
}

export const BEVERAGE_PRODUCTS: BeverageProductDef[] = [
  // 2250 ML
  {
    name: "Cola Next – 2250 ML",
    code: "CN-2250ML",
    brandCode: "CN",
    brandName: "Cola Next",
    size: "2250 ML",
    packaging: "Bottle",
    description: "Cola Next 2250 ML PET Bottle",
  },
  {
    name: "Fizup Next – 2250 ML",
    code: "FN-2250ML",
    brandCode: "FN",
    brandName: "Fizup Next",
    size: "2250 ML",
    packaging: "Bottle",
    description: "Fizup Next 2250 ML PET Bottle (Lemon Lime)",
  },
  {
    name: "Dare Next – 2250 ML",
    code: "DN-2250ML",
    brandCode: "DN",
    brandName: "Dare Next",
    size: "2250 ML",
    packaging: "Bottle",
    description: "Dare Next 2250 ML PET Bottle",
  },
  {
    name: "Rango Next – 2250 ML",
    code: "RN-2250ML",
    brandCode: "RN",
    brandName: "Rango Next",
    size: "2250 ML",
    packaging: "Bottle",
    description: "Rango Next 2250 ML PET Bottle (Orange)",
  },

  // 1500 ML
  {
    name: "Cola Next – 1500 ML",
    code: "CN-1500ML",
    brandCode: "CN",
    brandName: "Cola Next",
    size: "1500 ML",
    packaging: "Bottle",
    description: "Cola Next 1500 ML PET Bottle",
  },
  {
    name: "Fizup Next – 1500 ML",
    code: "FN-1500ML",
    brandCode: "FN",
    brandName: "Fizup Next",
    size: "1500 ML",
    packaging: "Bottle",
    description: "Fizup Next 1500 ML PET Bottle (Lemon Lime)",
  },
  {
    name: "Dare Next – 1500 ML",
    code: "DN-1500ML",
    brandCode: "DN",
    brandName: "Dare Next",
    size: "1500 ML",
    packaging: "Bottle",
    description: "Dare Next 1500 ML PET Bottle",
  },
  {
    name: "Anar Next – 1500 ML",
    code: "AN-1500ML",
    brandCode: "AN",
    brandName: "Anar Next",
    size: "1500 ML",
    packaging: "Bottle",
    description: "Anar Next 1500 ML PET Bottle (Pomegranate)",
  },
  {
    name: "Rango Next – 1500 ML",
    code: "RN-1500ML",
    brandCode: "RN",
    brandName: "Rango Next",
    size: "1500 ML",
    packaging: "Bottle",
    description: "Rango Next 1500 ML PET Bottle (Orange)",
  },
  {
    name: "Mint Next – 1500 ML",
    code: "MN-1500ML",
    brandCode: "MN",
    brandName: "Mint Next",
    size: "1500 ML",
    packaging: "Bottle",
    description: "Mint Next 1500 ML PET Bottle (Lemon Mint)",
  },

  // 1000 ML
  {
    name: "Cola Next – 1000 ML",
    code: "CN-1000ML",
    brandCode: "CN",
    brandName: "Cola Next",
    size: "1000 ML",
    packaging: "Bottle",
    description: "Cola Next 1000 ML PET Bottle",
  },
  {
    name: "Fizup Next – 1000 ML",
    code: "FN-1000ML",
    brandCode: "FN",
    brandName: "Fizup Next",
    size: "1000 ML",
    packaging: "Bottle",
    description: "Fizup Next 1000 ML PET Bottle (Lemon Lime)",
  },
  {
    name: "Dare Next – 1000 ML",
    code: "DN-1000ML",
    brandCode: "DN",
    brandName: "Dare Next",
    size: "1000 ML",
    packaging: "Bottle",
    description: "Dare Next 1000 ML PET Bottle",
  },
  {
    name: "Rango Next – 1000 ML",
    code: "RN-1000ML",
    brandCode: "RN",
    brandName: "Rango Next",
    size: "1000 ML",
    packaging: "Bottle",
    description: "Rango Next 1000 ML PET Bottle (Orange)",
  },
  {
    name: "Anar Next – 1000 ML",
    code: "AN-1000ML",
    brandCode: "AN",
    brandName: "Anar Next",
    size: "1000 ML",
    packaging: "Bottle",
    description: "Anar Next 1000 ML PET Bottle (Pomegranate)",
  },
  {
    name: "Lychee Next – 1000 ML",
    code: "LN-1000ML",
    brandCode: "LN",
    brandName: "Lychee Next",
    size: "1000 ML",
    packaging: "Bottle",
    description: "Lychee Next 1000 ML PET Bottle (Lychee)",
  },

  // 800 ML
  {
    name: "Cola Next – 800 ML",
    code: "CN-800ML",
    brandCode: "CN",
    brandName: "Cola Next",
    size: "800 ML",
    packaging: "Bottle",
    description: "Cola Next 800 ML PET Bottle",
  },
  {
    name: "Fizup Next – 800 ML",
    code: "FN-800ML",
    brandCode: "FN",
    brandName: "Fizup Next",
    size: "800 ML",
    packaging: "Bottle",
    description: "Fizup Next 800 ML PET Bottle (Lemon Lime)",
  },
  {
    name: "Rango Next – 800 ML",
    code: "RN-800ML",
    brandCode: "RN",
    brandName: "Rango Next",
    size: "800 ML",
    packaging: "Bottle",
    description: "Rango Next 800 ML PET Bottle (Orange)",
  },

  // 300 ML
  {
    name: "Cola Next – 300 ML",
    code: "CN-300ML",
    brandCode: "CN",
    brandName: "Cola Next",
    size: "300 ML",
    packaging: "Bottle",
    description: "Cola Next 300 ML PET Bottle",
  },
  {
    name: "Fizup Next – 300 ML",
    code: "FN-300ML",
    brandCode: "FN",
    brandName: "Fizup Next",
    size: "300 ML",
    packaging: "Bottle",
    description: "Fizup Next 300 ML PET Bottle (Lemon Lime)",
  },
  {
    name: "Dare Next – 300 ML",
    code: "DN-300ML",
    brandCode: "DN",
    brandName: "Dare Next",
    size: "300 ML",
    packaging: "Bottle",
    description: "Dare Next 300 ML PET Bottle",
  },
  {
    name: "Anar Next – 300 ML",
    code: "AN-300ML",
    brandCode: "AN",
    brandName: "Anar Next",
    size: "300 ML",
    packaging: "Bottle",
    description: "Anar Next 300 ML PET Bottle (Pomegranate)",
  },
  {
    name: "Rango Next – 300 ML",
    code: "RN-300ML",
    brandCode: "RN",
    brandName: "Rango Next",
    size: "300 ML",
    packaging: "Bottle",
    description: "Rango Next 300 ML PET Bottle (Orange)",
  },
  {
    name: "Mint Next – 300 ML",
    code: "MN-300ML",
    brandCode: "MN",
    brandName: "Mint Next",
    size: "300 ML",
    packaging: "Bottle",
    description: "Mint Next 300 ML PET Bottle (Lemon Mint)",
  },

  // 250 ML / Cans
  {
    name: "Can Cola Next – 250 ML",
    code: "CAN-CN-250ML",
    brandCode: "CN",
    brandName: "Cola Next",
    size: "250 ML",
    packaging: "Can",
    description: "Can Cola Next 250 ML Sleek Can",
  },
  {
    name: "Can Fizup Next – 250 ML",
    code: "CAN-FN-250ML",
    brandCode: "FN",
    brandName: "Fizup Next",
    size: "250 ML",
    packaging: "Can",
    description: "Can Fizup Next 250 ML Sleek Can (Lemon Lime)",
  },
  {
    name: "Can Dare Next – 280 ML",
    code: "CAN-DN-280ML",
    brandCode: "DN",
    brandName: "Dare Next",
    size: "280 ML",
    packaging: "Can",
    description: "Can Dare Next 280 ML Sleek Can (Energy Drink)",
  },
  {
    name: "Can Rango Next – 250 ML",
    code: "CAN-RN-250ML",
    brandCode: "RN",
    brandName: "Rango Next",
    size: "250 ML",
    packaging: "Can",
    description: "Can Rango Next 250 ML Sleek Can (Orange)",
  },
  {
    name: "Zero Can Fizup Next – 250 ML",
    code: "CAN-ZF-250ML",
    brandCode: "FN",
    brandName: "Fizup Next",
    size: "250 ML",
    packaging: "Can",
    description: "Zero Can Fizup Next 250 ML (Sugar Free)",
  },
  {
    name: "Zero Can Cola Next – 250 ML",
    code: "CAN-ZC-250ML",
    brandCode: "CN",
    brandName: "Cola Next",
    size: "250 ML",
    packaging: "Can",
    description: "Zero Can Cola Next 250 ML (Sugar Free)",
  },
];

export async function seedBeverageProducts(targetOrgId?: string) {

  // Determine target organization
  let organizationId = targetOrgId;
  if (!organizationId) {
    const defaultOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { name: { contains: "Cola Next", mode: "insensitive" } },
          { slug: "colanext" },
          { id: "XvLM6ho7gz20skKWktQkeDgYD4uGC9jE" },
        ],
      },
    });

    if (defaultOrg) {
      organizationId = defaultOrg.id;
    } else {
      const anyOrg = await prisma.organization.findFirst();
      if (!anyOrg) {
        throw new Error("No organization found. Please run db:seed:owner first.");
      }
      organizationId = anyOrg.id;
    }
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });

  console.log(`🥤 Seeding beverage products for organization: "${organization.name}" (${organization.id})`);

  // 1. Ensure Category "Beverages" exists
  const category = await prisma.category.upsert({
    where: {
      name_organizationId: {
        name: "Beverages",
        organizationId: organization.id,
      },
    },
    create: {
      name: "Beverages",
      shortCode: "BEV",
      description: "Carbonated beverages, soft drinks, energy drinks, and flavored drinks",
      organizationId: organization.id,
    },
    update: {
      shortCode: "BEV",
    },
  });
  console.log(`✅ Category confirmed: ${category.name} (${category.id})`);

  // 2. Ensure Brands exist under Beverages category
  const brandMap = new Map<string, string>();
  const uniqueBrands = Array.from(
    new Set(BEVERAGE_PRODUCTS.map((p) => JSON.stringify({ name: p.brandName, code: p.brandCode })))
  ).map((s) => JSON.parse(s) as { name: string; code: string });

  for (const b of uniqueBrands) {
    const brand = await prisma.brand.upsert({
      where: {
        name_categoryId_organizationId: {
          name: b.name,
          categoryId: category.id,
          organizationId: organization.id,
        },
      },
      create: {
        name: b.name,
        shortCode: b.code,
        categoryId: category.id,
        description: `${b.name} line of beverages`,
        organizationId: organization.id,
      },
      update: {
        shortCode: b.code,
      },
    });
    brandMap.set(b.name, brand.id);
    console.log(`✅ Brand confirmed: ${brand.name} [${brand.shortCode}] (${brand.id})`);
  }

  // 3. Upsert all 31 products and their inventory
  let createdCount = 0;
  let updatedCount = 0;

  for (const item of BEVERAGE_PRODUCTS) {
    const brandId = brandMap.get(item.brandName);
    if (!brandId) throw new Error(`Missing brand id for ${item.brandName}`);

    const existing = await prisma.product.findUnique({
      where: { productCode: item.code },
    });

    let product;
    if (existing) {
      product = await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          categoryId: category.id,
          brandId,
          description: item.description,
          unit: "pcs",
          isActive: true,
          gstApplicable: true,
        },
      });
      updatedCount += 1;
    } else {
      product = await prisma.product.create({
        data: {
          productCode: item.code,
          name: item.name,
          organizationId: organization.id,
          categoryId: category.id,
          brandId,
          unit: "pcs",
          unitCost: 0,
          unitPrice: 0,
          description: item.description,
          isActive: true,
          gstApplicable: true,
          gstRate: 0,
        },
      });
      createdCount += 1;
    }

    // Ensure inventory record exists
    await prisma.inventory.upsert({
      where: { productId: product.id },
      create: {
        productId: product.id,
        organizationId: organization.id,
        quantityOnHand: 0,
        quantityReserved: 0,
        reorderLevel: 10,
      },
      update: {},
    });
  }

  console.log(`🎉 Finished! Created: ${createdCount}, Updated: ${updatedCount}, Total: ${BEVERAGE_PRODUCTS.length} products.`);
}

if (process.argv[1]?.endsWith("seed-beverages.ts")) {
  seedBeverageProducts()
    .catch((err) => {
      console.error("❌ Failed to seed beverage products:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
