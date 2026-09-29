import prisma from "@/lib/prisma";
import { ReturnFormData } from "@/types/return";
import type { Prisma } from "../../prisma/generated";

export async function addReturn(
  data: ReturnFormData,
  orgId: string,
  userId: string
) {
  try {
    const returnItemsArray = Array.isArray(data.items)
      ? data.items
      : [data.items];

    const returns = await prisma.return.create({
      data: {
        returnCode: data.returnCode,
        returnType: data.returnType,
        returnDate: new Date(data.returnDate),
        reason: data.reason,
        userId,
        organizationId: orgId,
        items: {
          create: returnItemsArray.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxAmount: item.taxAmount,
            discount: item.discount,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return {
      success: true,
      message: "Return created successfully",
      data: returns,
    };
  } catch (error) {
    console.error("Failed to create return:", error);
    return {
      success: false,
      message: "Failed to create return",
    };
  }
}

export async function getReturns(orgId: string) {
  try {
    const returns = await prisma.return.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
      },
      orderBy: { returnDate: "desc" },
    });
    return {
      success: true,
      data: returns,
    };
  } catch (error) {
    console.error("Failed to get returns:", error);
    return {
      success: false,
      message: "Failed to fetch returns",
      data: [],
    };
  }
}

export async function getReturnById(id: string) {
  try {
    const returns = await prisma.return.findMany({
      where: {
        id,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
      },
      orderBy: { returnDate: "desc" },
    });
    return {
      success: true,
      data: returns,
    };
  } catch (error) {
    console.error("Failed to get returns:", error);
    return {
      success: false,
      message: "Failed to fetch returns",
      data: [],
    };
  }
}

export async function updateReturn(id: string, data: Partial<ReturnFormData>) {
  try {
    const updateData: Prisma.ReturnUncheckedUpdateInput = {};

    if (data.returnCode !== undefined) updateData.returnCode = data.returnCode;
    if (data.returnType !== undefined) updateData.returnType = data.returnType;
    if (data.returnDate !== undefined)
      updateData.returnDate = new Date(data.returnDate);
    if (data.reason !== undefined) updateData.reason = data.reason;

    const updatedReturn = await prisma.return.updateMany({
      where: { id },
      data: updateData,
    });

    if (updatedReturn.count === 0) {
      return {
        success: false,
        message: "Return not found or not authorized to update",
      };
    }

    return {
      success: true,
      message: "Return updated successfully",
    };
  } catch (error) {
    console.error("Failed to update return:", error);
    return {
      success: false,
      message: "Failed to update return",
    };
  }
}

export async function deleteReturn(id: string) {
  try {
    const deletedReturn = await prisma.return.deleteMany({
      where: { id },
    });

    if (deletedReturn.count === 0) {
      return {
        success: false,
        message: "Return not found or not authorized to delete",
      };
    }

    return {
      success: true,
      message: "Return deleted successfully",
    };
  } catch (error) {
    console.error("Failed to delete return:", error);
    return {
      success: false,
      message: "Failed to delete return",
    };
  }
}
