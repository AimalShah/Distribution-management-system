import {
  getCurrentUserActiveOrganizationId,
} from "@/actions/user";
import prisma from "@/lib/prisma";
import { BrandFormData } from "@/types/brand";

export async function addBrand(data: BrandFormData) {
  try {
    const orgId = await getCurrentUserActiveOrganizationId();

    const brand = await prisma.brand.create({
      data: {
        name: data.name,
        ...(data.description && { description: data.description }),
        categoryId: data.categoryId,
        organizationId: orgId,
      },
    });

    return {
      success: true,
      message: "Brand created successfully",
      data: brand,
    };
  } catch (error) {
    console.error("Failed to create brand:", error);
    return {
      success: false,
      message: "Failed to create brand",
    };
  }
}

export async function getBrands() {
  const organizationId = await getCurrentUserActiveOrganizationId();
  try {
    const brands = await prisma.brand.findMany({
      where: {
        organizationId,
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: brands,
    };
  } catch (error) {
    console.error("Failed to get brands:", error);
    return {
      success: false,
      message: "Failed to fetch brands",
    };
  }
}

export async function getBrandById(id: string) {
  try {
    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) return { success: false, message: "Brand not found" };

    return { success: true, data: brand };
  } catch (error) {
    console.error("Failed to fetch brand:", error);
    return { success: false, message: "Failed to fetch brand" };
  }
}

export async function updateBrand(id: string, data: BrandFormData) {
  try {
    const brand = await prisma.brand.update({
      where: { id },
      data: {
        name: data.name.trim(),
        ...(data.description && { description: data.description.trim() }),
        categoryId: data.categoryId,
      },
    });

    return {
      success: true,
      message: "Brand updated successfully",
      data: brand,
    };
  } catch (error) {
    console.error("Failed to fetch brand:", error);
    return { success: false, message: "Failed to fetch brand" };
  }
}

export async function deleteBrand(id: string) {
  try {
    await prisma.brand.delete({ where: { id } });
    return { success: true, message: "Brand deleted successfully" };
  } catch (error) {
    console.error("Failed to delete brand:", error);
    return { success: false, message: "Failed to delete brand" };
  }
}
