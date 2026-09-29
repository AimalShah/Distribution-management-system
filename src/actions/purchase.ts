"use server";

import {
  getCurrentUser,
  getCurrentUserActiveOrganizationId,
} from "@/actions/user";
import {
  addPurchase,
  deletePurchase,
  getPurchaseById,
  getPurchases,
  updatePurchase,
} from "@/services/purchase";
import { PurchaseFormData } from "@/types/purchase";
import { revalidatePath } from "next/cache";

export async function createPurchase(data: PurchaseFormData) {
  const organizationId = await getCurrentUserActiveOrganizationId();
  const { curntUser } = await getCurrentUser();

  const result = await addPurchase(data, organizationId, curntUser.id);

  revalidatePath("/purchase");
  revalidatePath("/inventory");
  return result;
}
export async function fetchPurchases() {
  const organizationId = await getCurrentUserActiveOrganizationId();
  const result = getPurchases(organizationId);
  return result;
}

export async function fetchProduct(id: string) {
  const result = await getPurchaseById(id);
  return result;
}

export async function editPurchase(
  id: string,
  data: Partial<PurchaseFormData>
) {
  const organizationId = await getCurrentUserActiveOrganizationId();

  const result = await updatePurchase(id, data, organizationId);
  if (!result.success) {
    throw new Error(result.message || "Error updating purchase");
  }

  revalidatePath("/purchase");
  revalidatePath("/inventory");

  return result;
}

export async function removePurchase(id: string) {
  const organizationId = await getCurrentUserActiveOrganizationId();

  const result = await deletePurchase(id, organizationId);
  if (!result.success) {
    throw new Error(result.message || "Error deleting purchase");
  }

  revalidatePath("/purchase");
  revalidatePath("/inventory");

  return result;
}
