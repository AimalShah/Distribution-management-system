import prisma from "@/lib/prisma";
import type { Prisma } from "../../prisma/generated";

export async function addInventory(data: {
  productId: string;
  quantityOnHand: number;
  quantityReserved?: number;
  reorderLevel?: number;
  maxStockLevel?: number;
  organizationId: string;
}) {
  try {
    const inventory = await prisma.inventory.create({
      data: {
        productId: data.productId,
        quantityOnHand: data.quantityOnHand,
        quantityReserved: data.quantityReserved || 0,
        reorderLevel: data.reorderLevel || 0,
        maxStockLevel: data.maxStockLevel || null,
        organizationId: data.organizationId,
      },
    });

    return {
      success: true,
      message: "Inventory created successfully",
      data: inventory,
    };
  } catch (error) {
    console.error("Failed to create inventory:", error);
    return {
      success: false,
      message: "Failed to create inventory",
    };
  }
}

export async function getInventory(orgId: string) {
  try {
    const inventory = await prisma.inventory.findMany({
      where: { organizationId: orgId },
      include: { product: true, logs: true },
      orderBy: { updatedAt: "desc" },
    });

    return {
      success: true,
      data: inventory,
    };
  } catch (error) {
    console.error("Failed to get inventory:", error);
    return {
      success: false,
      message: "Failed to fetch inventory",
      data: [],
    };
  }
}

export async function fetchInventoryLogs(orgId: string, productId?: string) {
  try {
    const whereClause: Prisma.InventoryLogWhereInput = {
      product: { organizationId: orgId },
    };
    if (productId) {
      whereClause.productId = productId;
    }

    const logs = await prisma.inventoryLog.findMany({
      where: whereClause,
      include: {
        product: true,
        user: { select: { name: true, email: true } },
        inventory: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: logs,
    };
  } catch (error) {
    console.error("Failed to get inventory logs:", error);
    return {
      success: false,
      message: "Failed to fetch inventory logs",
      data: [],
    };
  }
}

export async function adjustInventoryQuantity(data: {
  productId: string;
  quantity: number;
  reason: string;
  movementType: "ADJUSTMENT" | "TRANSFER" | "RETURN" | "DAMAGED" | "EXPIRED";
  organizationId: string;
  userId: string;
}) {
  try {
    const inventory = await prisma.inventory.findUnique({
      where: { productId: data.productId },
    });

    if (!inventory) {
      return { success: false, message: "Inventory not found for this product" };
    }

    const previousQty = inventory.quantityOnHand;
    let newQty = previousQty;

    switch (data.movementType) {
      case "ADJUSTMENT":
      case "TRANSFER":
        newQty = data.quantity;
        break;
      case "RETURN":
        newQty = previousQty + data.quantity;
        break;
      case "DAMAGED":
      case "EXPIRED":
        newQty = previousQty - data.quantity;
        break;
    }

    await prisma.inventory.update({
      where: { productId: data.productId },
      data: { quantityOnHand: Math.max(0, newQty), updatedAt: new Date() },
    });

    await prisma.inventoryLog.create({
      data: {
        movementType: data.movementType,
        quantity: data.quantity,
        previousQty,
        newQty: Math.max(0, newQty),
        reason: data.reason,
        userId: data.userId,
        inventoryId: inventory.id,
        productId: data.productId,
      },
    });

    return {
      success: true,
      message: "Inventory adjusted successfully",
    };
  } catch (error) {
    console.error("Failed to adjust inventory:", error);
    return {
      success: false,
      message: "Failed to adjust inventory",
    };
  }
}

export async function fetchLowStockProducts(orgId: string) {
  try {
    const lowStockProducts = await prisma.inventory.findMany({
      where: {
        organizationId: orgId,
        quantityOnHand: {
          lte: prisma.inventory.fields?.reorderLevel || 0,
        },
      },
      include: { product: true },
      orderBy: { quantityOnHand: "asc" },
    });

    return {
      success: true,
      data: lowStockProducts,
    };
  } catch (error) {
    console.error("Failed to get low stock products:", error);
    return {
      success: false,
      message: "Failed to fetch low stock products",
      data: [],
    };
  }
}

export async function updateInventorySettings(data: {
  productId: string;
  reorderLevel?: number;
  maxStockLevel?: number;
  quantityReserved?: number;
  organizationId: string;
}) {
  try {
    const inventory = await prisma.inventory.findUnique({
      where: { productId: data.productId },
    });

    if (!inventory) {
      return { success: false, message: "Inventory not found for this product" };
    }

    const updatedInventory = await prisma.inventory.update({
      where: { productId: data.productId },
      data: {
        reorderLevel: data.reorderLevel,
        maxStockLevel: data.maxStockLevel,
        quantityReserved: data.quantityReserved,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: "Inventory settings updated successfully",
      data: updatedInventory,
    };
  } catch (error) {
    console.error("Failed to update inventory settings:", error);
    return {
      success: false,
      message: "Failed to update inventory settings",
    };
  }
}
