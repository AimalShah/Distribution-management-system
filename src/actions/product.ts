"use server";

import { getCurrentUserActiveOrganizationId } from "@/actions/user";
import prisma from "@/lib/prisma";
import {
  addProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from "@/services/product";
import { ProductFormData } from "@/types/product";
import { revalidatePath } from "next/cache";

export async function createProduct(data: ProductFormData) {
  const organizationId = await getCurrentUserActiveOrganizationId();

  const result = await addProduct(data, organizationId);
  if (result.success) {
    revalidatePath("/product");
    revalidatePath("/inventory");
  }
  return result;
}

export async function fetchProducts() {
  const organizationId = await getCurrentUserActiveOrganizationId();
  const result = await getProducts(organizationId);
  return result;
}
export async function editProduct(id: string, data: Partial<ProductFormData>) {
  const organizationId = await getCurrentUserActiveOrganizationId();

  const result = await updateProduct(id, data, organizationId);
  if (!result.success) {
    throw new Error(result.message);
  }

  revalidatePath("/product");
  revalidatePath("/inventory");
  return result;
}

export async function removeProduct(id: string) {
  const result = await deleteProduct(id);
  if (!result.success) {
    throw new Error(result.message);
  }
  return result;
}
