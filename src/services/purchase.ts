import { getCurrentUser } from "@/actions/user";
import prisma from "@/lib/prisma";
import { PurchaseFormData } from "@/types/purchase";
import type { Prisma } from "../../prisma/generated";

export async function addPurchase(
  data: PurchaseFormData,
  orgId: string,
  userId: string
) {
  try {
    const purchase = await prisma.purchase.create({
      data: {
        purchaseCode: data.purchaseCode,
        supplierId: data.supplierId,
        purchaseDate: new Date(data.purchaseDate),
        totalAmount: data.totalAmount,
        status: "Pending",
        organizationId: orgId,
        purchaseItems: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.quantity * item.unitCost,
          })),
        },
      },
      include: {
        supplier: true,
        purchaseItems: {
          include: {
            product: true,
          },
        },
      },
    });

    for (const item of purchase.purchaseItems) {
      const inventory = await prisma.inventory.findUnique({
        where: { productId: item.productId },
      });

      const previousQty = inventory?.quantityOnHand || 0;
      const newQty = previousQty + item.quantity;

      const updateInventory = await prisma.inventory.upsert({
        where: { productId: item.productId },
        update: {
          quantityOnHand: newQty,
          updatedAt: new Date(),
        },
        create: {
          productId: item.productId,
          quantityOnHand: item.quantity,
          reorderLevel: 10,
          organizationId: orgId,
        },
      });

      await prisma.inventoryLog.create({
        data: {
          movementType: "IN",
          quantity: item.quantity,
          previousQty,
          newQty,
          reason: `Stock In from Purchase ${data.purchaseCode}`,
          reference: data.purchaseCode,
          userId,
          inventoryId: updateInventory.id,
          productId: item.productId,
        },
      });
    }

    return {
      success: true,
      message: "Purchase created successfully",
      data: purchase,
    };
  } catch (error) {
    console.error("Failed to create purchase:", error);
    return {
      success: false,
      message: "Failed to create purchase",
    };
  }
}
export async function getPurchases(orgId: string) {
  try {
     const purchases = await prisma.purchase.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        supplier: true,
        purchaseItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { purchaseDate: "desc" },
    });

    return {
      success: true,
      data: purchases,
    };
  } catch (error) {
    console.error("Failed to get purchases:", error);
    return {
      success: false,
      message: "Failed to fetch purchases",
      data: [],
    };
  }
}


export async function getPurchaseById(id: string) {
  try {
     const purchases = await prisma.purchase.findMany({
      where: {
        id,
      },
      include: {
        supplier: true,
        purchaseItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { purchaseDate: "desc" },
    });

    return {
      success: true,
      data: purchases,
    };
  } catch (error) {
    console.error("Failed to get purchases:", error);
    return {
      success: false,
      message: "Failed to fetch purchases",
      data: [],
    };
  }
}
export async function updatePurchase(
  id: string,
  data: Partial<PurchaseFormData>,
  orgId: string
) {
  try {
    const updateData: Prisma.PurchaseUncheckedUpdateInput = {};

    if (data.purchaseCode !== undefined) updateData.purchaseCode = data.purchaseCode;
    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.purchaseDate !== undefined)
      updateData.purchaseDate = new Date(data.purchaseDate);
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
    if (data.status !== undefined) updateData.status = data.status;

    const purchase = await prisma.purchase.update({
      where:  {id, organizationId: orgId },
      data: updateData,
      include: {
        supplier: true,
        purchaseItems: {
          include: { product: true },
        },
      },
    });

    return {
      success: true,
      message: "Purchase updated successfully",
      data: purchase,
    };
  } catch (error) {
    console.error("Failed to update purchase:", error);
    return { success: false, message: "Failed to update purchase" };
  }
}

export async function deletePurchase(id: string, orgId: string) {
  try {
    await prisma.purchase.delete({
      where: { id, organizationId: orgId },
    });

    return { success: true, message: "Purchase deleted successfully" };
  } catch (error) {
    console.error("Failed to delete purchase:", error);
    return { success: false, message: "Failed to delete purchase" };
  }
}
