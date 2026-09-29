"use server";

import { getCurrentUserActiveOrganizationId } from "@/actions/user";
import {
  addCategory,
  deleteCategory,
  getCategorys,
  getCatgoryById,
  updateCategory,
} from "@/services/category";
import { CategoryFormData } from "@/types/category";
import { revalidatePath } from "next/cache";

export async function createCategory(data: CategoryFormData) {
  const organizationId = await getCurrentUserActiveOrganizationId();

  const result = await addCategory(data, organizationId);
  if (result.success) revalidatePath("/product");

  return result;
}

export async function fetchCategories() {
  const organizationId = await getCurrentUserActiveOrganizationId();
  const result = await getCategorys(organizationId);

  return result;
}

export async function fetchCategory(id: string) {
  return await getCatgoryById(id);
}

export async function editCategory(id: string, data: CategoryFormData) {
  const result = await updateCategory(id, data);
  if (result.success) revalidatePath("/product");
  return result;
}

export async function removeCategory(id: string) {
  const result = await deleteCategory(id);
  if (result.success) revalidatePath("/product");
  return result;
}
