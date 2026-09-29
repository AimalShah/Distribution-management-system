import prisma from "@/lib/prisma";
import { CategoryFormData } from "@/types/category";

export async function addCategory(data: CategoryFormData, orgId: string) {
  try {
    const category = await prisma.category.create({
      data: {
        name: data.name,
        ...(data.description && { description: data.description }),
        organizationId: orgId,
      },
    });
    return {
      success: true,
      message: "category added successfully",
      data: category,
    };
  } catch (error) {
    console.error("Failed to add category:", error);
    return { success: false, message: "Failed to add category" };
  }
}

export async function getCategorys(orgId: string) {
  try {
    const categories = await prisma.category.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        brands: true,
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: categories,
    };
  } catch (error) {
    console.error("Failed to get categories:", error);
    return {
      success: false,
      message: "Failed to fetch categories",
    };
  }
}

export async function getCatgoryById(id: string) {
  try {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) return { success: false, message: "category not found" };

    return { success: true, data: category };
  } catch (error) {
    console.error("Failed to fetch category:", error);
    return { success: false, message: "Failed to fetch category" };
  }
}

export async function updateCategory(id: string, data: CategoryFormData) {
  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        name: data.name.trim(),
        ...(data.description && { description: data.description.trim() }),
      },
    });

    return {
      success: true,
      message: "category updated successfully",
      data: category,
    };
  } catch (error) {
    console.error("Failed to fetch category:", error);
    return { success: false, message: "Failed to fetch category" };
  }
}

export async function deleteCategory(id: string) {
  try {
    await prisma.category.delete({ where: { id } });
    return { success: true, message: "Category deleted successfully" };
  } catch (error) {
    console.error("Failed to delete category:", error);
    return { success: false, message: "Failed to delete category" };
  }
}
