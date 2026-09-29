import prisma from "@/lib/prisma";
import { ProductFormData } from "@/types/product";
import type { Prisma } from "../../prisma/generated";

export async function addProduct(data: ProductFormData, orgId: string) {
  try {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        productCode: data.productCode,
        unit: data.unit,
        description: data.description || "",
        unitCost: data.unitCost,
        unitPrice: data.unitPrice,
        isActive: data.isActive,
        organizationId: orgId,
        categoryId: data.category,
        brandId: data.brand,
      },
    });

    return {
      success: true,
      message: "Product created successfully",
      data: product,
    };
  } catch (error) {
    console.error("Failed to create product:", error);
    return {
      success: false,
      message: "Failed to create product",
    };
  }
}

export async function getProducts(orgId: string) {
  try {
    const products = await prisma.product.findMany({
      where: {
        organizationId: orgId,
      },
      orderBy: { name: "asc" },
      include: {
        category: true,
        brand: true,
        inventory: true,
        logs: true,
        purchaseItems: true,
        returnItems: true,
        saleItems: true,
      },
    });

    return {
      success: true,
      data: products,
    };
  } catch (error) {
    console.error("Failed to get products:", error);
    return {
      success: false,
      message: "Failed to fetch products",
      data: [],
    };
  }
}

export async function updateProduct(
  id: string,
  data: Partial<ProductFormData>,
  orgId: string
) {
  try {
    const updateData: Prisma.ProductUncheckedUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.productCode !== undefined)
      updateData.productCode = data.productCode;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.unitCost !== undefined) updateData.unitCost = data.unitCost;
    if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.category !== undefined) updateData.categoryId = data.category;
    if (data.brand !== undefined) updateData.brandId = data.brand;

    const product = await prisma.product.update({
      where: { id, organizationId: orgId },
      data: updateData,
    });

    return {
      success: true,
      message: "Product updated successfully",
      data: product,
    };
  } catch (error) {
    console.error("Failed to update product:", error);
    return { success: false, message: "Failed to update product" };
  }
}

export async function deleteProduct(id: string) {
  try {
    await prisma.product.delete({
      where: { id },
    });

    return { success: true, message: "Product deleted successfully" };
  } catch (error) {
    console.error("Failed to delete product:", error);
    return { success: false, message: "Failed to delete product" };
  }
}
