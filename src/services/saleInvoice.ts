import prisma from "@/lib/prisma";
import { SaleInvoiceFormData } from "@/types/saleInvoice";
import type { Prisma } from "../../prisma/generated";

export async function addSaleInvoice(
  data: SaleInvoiceFormData,
  orgId: string,
  userId: string
) {
  try {
    const saleInvoiceItemsArray = Array.isArray(data.items)
      ? data.items
      : [data.items];

    const saleInvoice = await prisma.sale.create({
      data: {
        saleCode: data.saleCode,
        customerId: data.customerId,
        saleDate: data.saleDate,
        taxAmount: data.taxAmount,
        discount: data.discount,
        totalAmount: data.totalAmount,
        status: data.status,
        organizationId: orgId,
        items: {
          create: saleInvoiceItemsArray.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            taxPercent: item.taxPercent || null,
            discount: data.discount || null,
          })),
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    for (const item of saleInvoice.items) {
      const inventory = await prisma.inventory.findUnique({
        where: { productId: item.productId },
      });

      if (!inventory) {
        console.error(`Inventory not found for product ID ${item.productId}`);
        continue;
      }

      const previousQty = inventory.quantityOnHand || 0;
      const newQty = previousQty - item.quantity;

      if (newQty < 0) {
        console.warn(`⚠️ Not enough stock for product ID ${item.productId}`);
      }

      await prisma.inventory.update({
        where: { productId: item.productId },
        data: {
          quantityOnHand: Math.max(0, newQty),
          updatedAt: new Date(),
        },
      });

      await prisma.inventoryLog.create({
        data: {
          movementType: "OUT",
          quantity: item.quantity,
          previousQty,
          newQty: Math.max(0, newQty),
          reason: `Stock Out from Sale ${saleInvoice.saleCode}`,
          reference: saleInvoice.saleCode,
          userId,
          inventoryId: inventory.id,
          productId: item.productId,
        },
      });
    }

    return {
      success: true,
      message: "Sale invoice created successfully",
      data: saleInvoice,
    };
  } catch (error) {
    console.error("Failed to create sale invoice:", error);
    return {
      success: false,
      message: "Failed to create sale invoice",
    };
  }
}

export async function getSaleInvoices(orgId: string) {
  try {
    const saleInvoices = await prisma.sale.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { saleDate: "desc" },
    });

    return {
      success: true,
      data: saleInvoices,
    };
  } catch (error) {
    console.error("Failed to get sale invoices:", error);
    return {
      success: false,
      message: "Failed to fetch sale invoices",
      data: [],
    };
  }
}

export async function getSaleInvoiceDetail(saleCode: string) {
  try {
    const saleInvoiceDetail = await prisma.sale.findUnique({
      where: {
        saleCode,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!saleInvoiceDetail) {
      return {
        success: false,
        message: "Sale invoice not found",
        data: null,
      };
    }

    return {
      success: true,
      data: saleInvoiceDetail,
    };
  } catch (error) {
    console.error("Failed to get sale invoice:", error);

    return {
      success: false,
      message: "Failed to fetch sale invoice",
      data: null,
    };
  }
}

export async function getSaleByCustomer(customerId: string) {
  try {
    const saleInvoices = await prisma.sale.findMany({
      where: { customerId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return saleInvoices;
  } catch (err) {
    console.error("Error fetching sales:", err);
    throw err;
  }
}

export async function updateSaleInvoice(
  id: string,
  data: Partial<SaleInvoiceFormData>
) {
  try {
    const updateData: Prisma.SaleUncheckedUpdateInput = {};

    if (data.saleCode !== undefined) updateData.saleCode = data.saleCode;
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.saleDate !== undefined) updateData.saleDate = data.saleDate;
    if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount;
    if (data.discount !== undefined) updateData.discount = data.discount;
    if (data.totalAmount !== undefined)
      updateData.totalAmount = data.totalAmount;
    if (data.status !== undefined) updateData.status = data.status;

    const updated = await prisma.sale.updateMany({
      where: { id },
      data: updateData,
    });

    if (updated.count === 0) {
      return {
        success: false,
        message: "Sale invoice not found or unauthorized",
      };
    }

    return { success: true, message: "Sale invoice updated successfully" };
  } catch (error) {
    console.error("Failed to update sale invoice:", error);
    return { success: false, message: "Failed to update sale invoice" };
  }
}

export async function deleteSaleInvoice(id: string) {
  try {
    const deleted = await prisma.sale.deleteMany({
      where: { id },
    });

    if (deleted.count === 0) {
      return {
        success: false,
        message: "Sale invoice not found or unauthorized",
      };
    }

    return { success: true, message: "Sale invoice deleted successfully" };
  } catch (error) {
    console.error("Failed to delete sale invoice:", error);
    return { success: false, message: "Failed to delete sale invoice" };
  }
}
