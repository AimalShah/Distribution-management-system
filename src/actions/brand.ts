"use server";

import {
  addBrand,
  deleteBrand,
  getBrandById,
  getBrands,
  updateBrand,
} from "@/services/brand";
import { BrandFormData } from "@/types/brand";
import { revalidatePath } from "next/cache";

export async function createBrand(data: BrandFormData) {
  const result = await addBrand(data);
  if (result.success) revalidatePath("/product");

  return result;
}

export async function fetchBrands() {
  return await getBrands();
}

export async function fetchBrand(id: string) {
  return await getBrandById(id);
}

export async function editBrand(id: string, data: BrandFormData) {
  const result = await updateBrand(id, data);
  if (result.success) revalidatePath("/product");
  return result;
}

export async function removeBrand(id: string) {
  const result = await deleteBrand(id);
  if (result.success) revalidatePath("/product");
  return result;
}
