"use server";

import { getCurrentUserActiveOrganizationId } from "@/actions/user";

import {
  addSupplier,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
} from "@/services/supplier";

import { SupplierFormData } from "@/types/supplier";
import { revalidatePath } from "next/cache";

export async function createSupplier(data: SupplierFormData) {
  const organizationId = await getCurrentUserActiveOrganizationId();

  const result = await addSupplier(data, organizationId);
  if (!result.success) throw new Error(result.message);

  revalidatePath("/suppliers");
  return result;
}

export async function fetchSuppliers() {
  const organizationId = await getCurrentUserActiveOrganizationId();

  const result = await getSuppliers(organizationId);
  return result;
}

export async function editSupplier(
  id: string,
  data: Partial<SupplierFormData>
) {
  const result = await updateSupplier(id, data);
  if (!result.success) throw new Error(result.message);

  revalidatePath("/suppliers");
  return result;
}

export async function removeSupplier(id: string) {
  const result = await deleteSupplier(id);
  if (!result.success) throw new Error(result.message);

  revalidatePath("/suppliers");
  return result;
}
