// prisma/seed.js
// First import, because it has to populate `process.env` before `../src/client`
// builds a PrismaClient from it. See `./load-env`.
import "./load-env";
import prisma from "../src/client";
import { faker } from "@faker-js/faker";
import type { InventoryMovement } from "./generated/client";

/** faker v9 dropped `date.past({ days })`; anchor a refDate instead. */
function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clean up existing data (optional)
  console.log("🧹 Cleaning up existing data...");
  await prisma.inventoryLog.deleteMany();
  await prisma.returnItem.deleteMany();
  await prisma.return.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.member.deleteMany({
    where: {
      user: {
        email: { not: "owner@test.com" },
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      email: { not: "owner@test.com" },
    },
  });

  // 1. Get or Create Organization
  let organization = await prisma.organization.findFirst();

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        id: "XvLM6ho7gz20skKWktQkeDgYD4uGC9jE",
        name: "Acme Distribution",
        slug: "acme",
        // `Organization.createdAt` has no `@default(now())` in the schema, so
        // the row cannot be inserted without one -- the seed stopped here with
        // P2015-style "Argument createdAt is missing" on a fresh database.
        createdAt: new Date(),
      },
    });
  }

  // 2. Get or Create Owner user
  let owner = await prisma.user.findFirst({
    where: { email: "owner@test.com" },
  });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        id: "JEXqru5KeZxSMUhEQ1I6P5hJgMepXMum",
        name: "Test Owner",
        email: "owner@test.com",
        emailVerified: true,
        organizationId: organization.id,
        isOwner: true,
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Ensure owner is an organization member
  const ownerMember = await prisma.member.findFirst({
    where: { userId: owner.id, organizationId: organization.id },
  });

  if (!ownerMember) {
    await prisma.member.create({
      data: {
        id: "member_" + faker.string.alphanumeric(20),
        organizationId: organization.id,
        userId: owner.id,
        role: "owner",
        createdAt: new Date(),
      },
    });
  }

  const users = [owner];

  // Additional staff users
  for (let i = 0; i < 15; i++) {
    const user = await prisma.user.create({
      data: {
        id: "user_" + faker.string.alphanumeric(20),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        emailVerified: faker.datatype.boolean(),
        image: faker.helpers.maybe(() => faker.image.avatar(), {
          probability: 0.7,
        }),
        createdAt: faker.date.past(),
        updatedAt: new Date(),
        organizationId: organization.id,
        isOwner: false,
        isFormComplete: faker.datatype.boolean(),
        role: faker.helpers.arrayElement([
          "ADMIN",
          "MANAGER",
          "STAFF",
          "VIEWER",
        ]),
        banned: faker.helpers.maybe(() => true, { probability: 0.1 }),
        banReason: faker.helpers.maybe(() => faker.lorem.sentence(), {
          probability: 0.1,
        }),
        banExpires: faker.helpers.maybe(() => faker.date.future(), {
          probability: 0.05,
        }),
      },
    });

    users.push(user);
  }

  console.log(`✅ Created ${users.length} users`);

  // 3. Create Members (link users to organization)
  for (const user of users) {
    if (user.id === owner.id) continue;
    await prisma.member.create({
      data: {
        id: "member_" + faker.string.alphanumeric(20),
        organizationId: organization.id,
        userId: user.id,
        role: user.role || "STAFF",
        createdAt: faker.date.past(),
      },
    });
  }

  console.log("✅ Created organization members");

  // 4. Create Sessions for some users
  for (let i = 0; i < 8; i++) {
    const user = faker.helpers.arrayElement(users);
    await prisma.session.create({
      data: {
        id: "session_" + faker.string.alphanumeric(20),
        expiresAt: faker.date.future(),
        token: faker.string.alphanumeric(64),
        createdAt: faker.date.recent(),
        updatedAt: new Date(),
        ipAddress: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        userId: user.id,
        activeOrganizationId: organization.id,
        impersonatedBy: faker.helpers.maybe(() => owner.id, {
          probability: 0.1,
        }),
      },
    });
  }

  console.log("✅ Created user sessions");

  // 5. Create Accounts (OAuth/social login accounts)
  for (let i = 0; i < 10; i++) {
    const user = faker.helpers.arrayElement(users);

    const provider = faker.helpers.arrayElement([
      "google",
      "github",
      "microsoft",
    ]);

    await prisma.account.create({
      data: {
        id: "account_" + faker.string.alphanumeric(20),
        accountId: faker.string.alphanumeric(12),
        providerId: provider,
        userId: user.id,
        accessToken: faker.string.alphanumeric(128),
        refreshToken: faker.helpers.maybe(() => faker.string.alphanumeric(128)),
        idToken: faker.helpers.maybe(() => faker.string.alphanumeric(256)),
        accessTokenExpiresAt: faker.date.future(),
        refreshTokenExpiresAt: faker.helpers.maybe(() => faker.date.future()),
        scope: "read write",
        createdAt: faker.date.past(),
        updatedAt: new Date(),
      },
    });
  }

  console.log("✅ Created OAuth accounts");

  // 6. Create Verifications
  for (let i = 0; i < 5; i++) {
    await prisma.verification.create({
      data: {
        id: "verification_" + faker.string.alphanumeric(20),
        identifier: faker.internet.email(),
        value: faker.string.alphanumeric(32),
        expiresAt: faker.date.future(),
        createdAt: faker.date.recent(),
        updatedAt: new Date(),
      },
    });
  }

  console.log("✅ Created email verifications");

  // 7. Create Invitations
  for (let i = 0; i < 8; i++) {
    await prisma.invitation.create({
      data: {
        id: "invite_" + faker.string.alphanumeric(20),
        organizationId: organization.id,
        email: faker.internet.email(),
        role: faker.helpers.arrayElement([
          "ADMIN",
          "MANAGER",
          "STAFF",
          "VIEWER",
        ]),
        status: faker.helpers.arrayElement([
          "PENDING",
          "ACCEPTED",
          "EXPIRED",
          "REVOKED",
        ]),
        expiresAt: faker.date.future(),
        inviterId: owner.id,
      },
    });
  }

  console.log("✅ Created organization invitations");

  // 8. Create Categories
  const categories = [];

  const categoryNames = [
    "Electronics",
    "Clothing",
    "Books",
    "Home & Garden",
    "Sports",
    "Automotive",
    "Health & Beauty",
    "Toys",
    "Food & Beverages",
    "Office Supplies",
  ];

  for (let i = 0; i < categoryNames.length; i++) {
    const category = await prisma.category.create({
      data: {
        name: categoryNames[i],
        organizationId: organization.id,
        description: faker.commerce.productDescription(),
        createdAt: faker.date.past(),
        updatedAt: new Date(),
      },
    });

    categories.push(category);
  }

  console.log(`✅ Created ${categories.length} categories`);

  // 9. Create Brands
  const brands = [];

  for (let i = 0; i < 30; i++) {
    const category = faker.helpers.arrayElement(categories);

    const brand = await prisma.brand.create({
      data: {
        name: `${faker.company.name()} ${i + 1}`,
        organizationId: organization.id,
        categoryId: category.id,
        description: faker.commerce.productDescription(),
        createdAt: faker.date.past(),
        updatedAt: new Date(),
      },
    });

    brands.push(brand);
  }

  console.log(`✅ Created ${brands.length} brands`);

  // 10. Create Products with Inventory
  const products = [];

  for (let i = 0; i < 200; i++) {
    const category = faker.helpers.arrayElement(categories);
    const categoryBrands = brands.filter((b) => b.categoryId === category.id);

    const brand =
      categoryBrands.length > 0
        ? faker.helpers.arrayElement(categoryBrands)
        : faker.helpers.arrayElement(brands);

    const unitPrice = faker.number.float({
      min: 10,
      max: 5000,
      fractionDigits: 2,
    });

    const unitCost =
      unitPrice * faker.number.float({ min: 0.4, max: 0.8, fractionDigits: 2 });

    const product = await prisma.product.create({
      data: {
        productCode: `PRD-${faker.string.alphanumeric(6).toUpperCase()}-${i + 1}`,
        organizationId: organization.id,
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        categoryId: category.id,
        brandId: brand.id,
        unit: faker.helpers.arrayElement([
          "piece",
          "box",
          "kg",
          "liter",
          "pack",
          "set",
        ]),
        unitPrice,
        unitCost,
        isActive: faker.helpers.weightedArrayElement([
          { weight: 9, value: true },
          { weight: 1, value: false },
        ]),
        createdAt: faker.date.past(),
        updatedAt: new Date(),
      },
    });

    products.push(product);

    // Create corresponding inventory entry
    await prisma.inventory.create({
      data: {
        productId: product.id,
        organizationId: organization.id,
        quantityOnHand: 0,
        quantityReserved: 0,
        reorderLevel: faker.number.int({ min: 5, max: 50 }),
        maxStockLevel: faker.helpers.maybe(() =>
          faker.number.int({ min: 100, max: 1000 })
        ),
        createdAt: faker.date.past(),
        updatedAt: new Date(),
      },
    });
  }

  console.log(`✅ Created ${products.length} products with inventory`);

  // 11. Create Suppliers
  const suppliers = [];

  for (let i = 0; i < 25; i++) {
    const supplier = await prisma.supplier.create({
      data: {
        supplierCode: `SUP-${faker.string.alphanumeric(6).toUpperCase()}-${i + 1}`,
        organizationId: organization.id,
        contactPerson: faker.person.fullName(),
        companyName: faker.company.name(),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        isActive: faker.helpers.weightedArrayElement([
          { weight: 8, value: true },
          { weight: 2, value: false },
        ]),
        createdAt: faker.date.past(),
        updatedAt: new Date(),
      },
    });

    suppliers.push(supplier);
  }

  console.log(`✅ Created ${suppliers.length} suppliers`);

  // 12. Create Customers
  const customers = [];

  for (let i = 0; i < 100; i++) {
    const customer = await prisma.customer.create({
      data: {
        customerCode: `CUST-${faker.string.alphanumeric(6).toUpperCase()}-${i + 1}`,
        organizationId: organization.id,
        name: faker.person.fullName(),
        email: faker.helpers.maybe(() => faker.internet.email(), {
          probability: 0.8,
        }),
        phone: faker.helpers.maybe(() => faker.phone.number(), {
          probability: 0.9,
        }),
        address: faker.helpers.maybe(() => faker.location.streetAddress()),
        city: faker.helpers.maybe(() => faker.location.city()),
        creditLimit: faker.helpers.maybe(() =>
          faker.number.float({ min: 1000, max: 50000, fractionDigits: 2 })
        ),
        isActive: faker.helpers.weightedArrayElement([
          { weight: 9, value: true },
          { weight: 1, value: false },
        ]),
        createdAt: faker.date.past(),
        updatedAt: new Date(),
      },
    });

    customers.push(customer);
  }

  console.log(`✅ Created ${customers.length} customers`);

  // 13. Create Purchases with Items and Update Inventory
  for (let i = 0; i < 80; i++) {
    const supplier = faker.helpers.arrayElement(suppliers);
    const user = faker.helpers.arrayElement(users);

    const purchase = await prisma.purchase.create({
      data: {
        purchaseCode: `PUR-${faker.string.alphanumeric(6).toUpperCase()}-${i + 1}`,
        organizationId: organization.id,
        supplierId: supplier.id,
        totalAmount: 0,
        taxAmount: faker.number.float({ min: 0, max: 500, fractionDigits: 2 }),
        discount: faker.helpers.maybe(() =>
          faker.number.float({ min: 0, max: 1000, fractionDigits: 2 })
        ),
        status: faker.helpers.weightedArrayElement([
          { weight: 8, value: "Completed" },
          { weight: 1, value: "Pending" },
          { weight: 1, value: "Cancelled" },
        ]),
        purchaseDate: faker.date.recent({ days: 60 }),
        createdAt: faker.date.recent({ days: 60 }),
        updatedAt: new Date(),
      },
    });

    let totalAmount = 0;
    const itemCount = faker.number.int({ min: 1, max: 8 });

    for (let j = 0; j < itemCount; j++) {
      const product = faker.helpers.arrayElement(products);
      const quantity = faker.number.int({ min: 5, max: 100 });

      const unitCost =
        product.unitCost *
        faker.number.float({ min: 0.9, max: 1.1, fractionDigits: 2 });

      const discount =
        faker.helpers.maybe(() =>
          faker.number.float({ min: 0, max: unitCost * quantity * 0.1 })
        ) || 0;

      const taxPercent = faker.helpers.maybe(() =>
        faker.number.float({ min: 0, max: 20 })
      );

      const totalCost = quantity * unitCost - discount;
      totalAmount += totalCost;

      await prisma.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          productId: product.id,
          quantity,
          unitCost,
          totalCost,
          batchNumber: faker.helpers.maybe(
            () => "BATCH-" + faker.string.alphanumeric(6)
          ),
          expiryDate: faker.helpers.maybe(() =>
            faker.date.future({ years: 2 })
          ),
          taxPercent,
          discount,
        },
      });

      // Update inventory if purchase is completed
      if (purchase.status === "Completed") {
        const inventory = await prisma.inventory.update({
          where: { productId: product.id },
          data: { quantityOnHand: { increment: quantity } },
        });

        // Create inventory log
        await prisma.inventoryLog.create({
          data: {
            inventoryId: inventory.id,
            productId: product.id,
            userId: user.id,
            movementType: "IN",
            quantity,
            previousQty: inventory.quantityOnHand - quantity,
            newQty: inventory.quantityOnHand,
            reason: "Purchase stock received",
            reference: purchase.purchaseCode,
            createdAt: purchase.purchaseDate,
            updatedAt: new Date(),
          },
        });
      }
    }

    // Update purchase total
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { totalAmount },
    });
  }

  console.log("✅ Created purchases with items and updated inventory");

  // 14. Create Sales with Items and Update Inventory
  for (let i = 0; i < 150; i++) {
    const customer = faker.helpers.arrayElement(customers);
    const user = faker.helpers.arrayElement(users);

    const sale = await prisma.sale.create({
      data: {
        saleCode: `SALE-${faker.string.alphanumeric(6).toUpperCase()}-${i + 1}`,
        customerId: customer.id,
        organizationId: organization.id,
        totalAmount: 0,
        taxAmount: faker.number.float({ min: 0, max: 200, fractionDigits: 2 }),
        discount: faker.helpers.maybe(() =>
          faker.number.float({ min: 0, max: 500, fractionDigits: 2 })
        ),
        status: faker.helpers.weightedArrayElement([
          { weight: 9, value: "Completed" },
          { weight: 1, value: "Pending" },
        ]),
        saleDate: faker.date.recent({ days: 45 }),
        createdAt: faker.date.recent({ days: 45 }),
        updatedAt: new Date(),
      },
    });

    let totalAmount = 0;
    const itemCount = faker.number.int({ min: 1, max: 6 });

    for (let j = 0; j < itemCount; j++) {
      const product = faker.helpers.arrayElement(products);
      const quantity = faker.number.int({ min: 1, max: 20 });

      const unitPrice =
        product.unitPrice *
        faker.number.float({ min: 0.9, max: 1.2, fractionDigits: 2 });

      const discount =
        faker.helpers.maybe(() =>
          faker.number.float({ min: 0, max: unitPrice * quantity * 0.15 })
        ) || 0;

      const taxPercent = faker.helpers.maybe(() =>
        faker.number.float({ min: 0, max: 25 })
      );

      const totalPrice = quantity * unitPrice - discount;
      totalAmount += totalPrice;

      await prisma.saleItem.create({
        data: {
          saleId: sale.id,
          productId: product.id,
          quantity,
          unitPrice,
          totalPrice,
          taxPercent,
          discount,
        },
      });

      // Update inventory if sale is completed
      if (sale.status === "Completed") {
        const currentInventory = await prisma.inventory.findUnique({
          where: { productId: product.id },
        });

        if (currentInventory && currentInventory.quantityOnHand >= quantity) {
          const inventory = await prisma.inventory.update({
            where: { productId: product.id },
            data: { quantityOnHand: { decrement: quantity } },
          });

          // Create inventory log
          await prisma.inventoryLog.create({
            data: {
              inventoryId: inventory.id,
              productId: product.id,
              userId: user.id,
              movementType: "OUT",
              quantity,
              previousQty: inventory.quantityOnHand + quantity,
              newQty: inventory.quantityOnHand,
              reason: "Stock sold to customer",
              reference: sale.saleCode,
              createdAt: sale.saleDate,
              updatedAt: new Date(),
            },
          });
        }
      }
    }

    // Update sale total
    await prisma.sale.update({
      where: { id: sale.id },
      data: { totalAmount },
    });
  }

  console.log("✅ Created sales with items and updated inventory");

  // 15. Create Returns with Items and Update Inventory
  for (let i = 0; i < 25; i++) {
    const user = faker.helpers.arrayElement(users);

    const returnType = faker.helpers.arrayElement([
      "SALE",
      "PURCHASE",
      "EXPIRED",
      "DAMAGED",
    ]);

    const returnRecord = await prisma.return.create({
      data: {
        returnCode: `RET-${faker.string.alphanumeric(6).toUpperCase()}-${i + 1}`,
        organizationId: organization.id,
        returnType,
        returnDate: faker.date.recent({ days: 30 }),
        reason: faker.helpers.arrayElement([
          "Defective product",
          "Wrong item received",
          "Customer changed mind",
          "Expired product",
          "Damaged in transit",
          "Quality issues",
        ]),
        userId: user.id,
        createdAt: faker.date.recent({ days: 30 }),
        updatedAt: new Date(),
      },
    });

    const itemCount = faker.number.int({ min: 1, max: 4 });

    for (let j = 0; j < itemCount; j++) {
      const product = faker.helpers.arrayElement(products);
      const quantity = faker.number.int({ min: 1, max: 10 });
      const unitPrice = product.unitPrice;

      const taxAmount = faker.number.float({
        min: 0,
        max: unitPrice * quantity * 0.1,
      });

      const discount =
        faker.helpers.maybe(() =>
          faker.number.float({ min: 0, max: unitPrice * quantity * 0.05 })
        ) || 0;

      await prisma.returnItem.create({
        data: {
          returnId: returnRecord.id,
          productId: product.id,
          quantity,
          taxAmount,
          discount,
          unitPrice,
          note: faker.helpers.maybe(() => faker.lorem.sentence()),
        },
      });

      // Update inventory for returns (add back to stock for SALE returns, remove for PURCHASE returns)
      const inventory = await prisma.inventory.findUnique({
        where: { productId: product.id },
      });

      if (inventory) {
        let inventoryUpdate;
        let movementType: InventoryMovement;
        let reason;

        if (returnType === "SALE") {
          inventoryUpdate = await prisma.inventory.update({
            where: { productId: product.id },
            data: { quantityOnHand: { increment: quantity } },
          });
          movementType = "RETURN";
          reason = "Customer return - added back to stock";
        } else if (returnType === "PURCHASE") {
          inventoryUpdate = await prisma.inventory.update({
            where: { productId: product.id },
            data: { quantityOnHand: { decrement: quantity } },
          });
          movementType = "OUT";
          reason = "Purchase return - removed from stock";
        } else {
          inventoryUpdate = await prisma.inventory.update({
            where: { productId: product.id },
            data: { quantityOnHand: { decrement: quantity } },
          });
          movementType = returnType === "EXPIRED" ? "EXPIRED" : "DAMAGED";
          reason = `${returnType.toLowerCase()} product removed from stock`;
        }

        // Create inventory log
        await prisma.inventoryLog.create({
          data: {
            inventoryId: inventoryUpdate.id,
            productId: product.id,
            userId: user.id,
            movementType,
            quantity,
            previousQty:
              returnType === "SALE"
                ? inventoryUpdate.quantityOnHand - quantity
                : inventoryUpdate.quantityOnHand + quantity,
            newQty: inventoryUpdate.quantityOnHand,
            reason,
            reference: returnRecord.returnCode,
            createdAt: returnRecord.returnDate,
            updatedAt: new Date(),
          },
        });
      }
    }
  }

  console.log("✅ Created returns with items and updated inventory");

  // 16. Create additional inventory adjustments
  for (let i = 0; i < 30; i++) {
    const product = faker.helpers.arrayElement(products);
    const user = faker.helpers.arrayElement(users);

    const adjustmentType = faker.helpers.arrayElement([
      "ADJUSTMENT",
      "TRANSFER",
      "DAMAGED",
      "EXPIRED",
    ]);

    const inventory = await prisma.inventory.findUnique({
      where: { productId: product.id },
    });

    if (inventory) {
      const isPositiveAdjustment = faker.datatype.boolean();
      const quantity = faker.number.int({ min: 1, max: 20 });

      let updatedInventory;

      if (isPositiveAdjustment) {
        updatedInventory = await prisma.inventory.update({
          where: { productId: product.id },
          data: { quantityOnHand: { increment: quantity } },
        });
      } else {
        updatedInventory = await prisma.inventory.update({
          where: { productId: product.id },
          data: {
            quantityOnHand: {
              decrement: Math.min(quantity, inventory.quantityOnHand),
            },
          },
        });
      }

      await prisma.inventoryLog.create({
        data: {
          inventoryId: inventory.id,
          productId: product.id,
          userId: user.id,
          movementType: adjustmentType,
          quantity: isPositiveAdjustment
            ? quantity
            : -Math.min(quantity, inventory.quantityOnHand),
          previousQty: inventory.quantityOnHand,
          newQty: updatedInventory.quantityOnHand,
          reason: faker.helpers.arrayElement([
            "Stock count adjustment",
            "Warehouse transfer",
            "Product damaged",
            "Product expired",
            "System correction",
            "Manual adjustment",
          ]),
          createdAt: faker.date.past({ refDate: daysAgo(30) }),
          updatedAt: new Date(),
        },
      });
    }
  }

  console.log("✅ Created inventory adjustments");

  // Final summary
  const summary = {
    organizations: 1,
    users: users.length,
    categories: categories.length,
    brands: brands.length,
    products: products.length,
    suppliers: suppliers.length,
    customers: customers.length,
    purchases: 80,
    sales: 150,
    returns: 25,
    inventoryAdjustments: 30,
  };

  console.log("🎉 Database seeding completed successfully!");
  console.log("📊 Summary:", summary);

  return summary;
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("🔌 Database connection closed");
  });
