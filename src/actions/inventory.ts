"use server";

import {
  getCurrentUser,
  getCurrentUserActiveOrganizationId,
} from "@/actions/user";
import {
  addInventory,
  fetchInventoryLogs,
  adjustInventoryQuantity,
  fetchLowStockProducts,
  updateInventorySettings,
  getInventory,
} from "@/services/inventory";
import { revalidatePath } from "next/cache";

export async function createInventoryAction(data: {
  productId: string;
  quantityOnHand: number;
  quantityReserved?: number;
  reorderLevel?: number;
  maxStockLevel?: number;
}) {
  const organizationId = await getCurrentUserActiveOrganizationId();

  const result = await addInventory({ ...data, organizationId });
  if (!result.success) throw new Error(result.message);

  revalidatePath("/inventory");
  return result;
}

export async function fetchInventory() {
  const organizationId = await getCurrentUserActiveOrganizationId();
  const result = await getInventory(organizationId);
  return result;
}

export async function fetchInventoryLogsAction(productId?: string) {
  const organizationId = await getCurrentUserActiveOrganizationId();
  const result = await fetchInventoryLogs(organizationId, productId);
  return result;
}

export async function adjustInventoryAction(data: {
  productId: string;
  quantity: number;
  reason: string;
  movementType: "ADJUSTMENT" | "TRANSFER" | "RETURN" | "DAMAGED" | "EXPIRED";
}) {
  const organizationId = await getCurrentUserActiveOrganizationId();
  const user = await getCurrentUser();

  if (!user.curntUser) throw new Error("User not authenticated");

  const result = await adjustInventoryQuantity({
    ...data,
    organizationId,
    userId: user.curntUser.id,
  });

  if (!result.success) throw new Error(result.message);

  revalidatePath("/inventory");
  return result;
}

export async function fetchLowStockProductsAction() {
  const organizationId = await getCurrentUserActiveOrganizationId();
  const result = await fetchLowStockProducts(organizationId);
  return result;
}

export async function updateInventorySettingsAction(data: {
  productId: string;
  reorderLevel?: number;
  maxStockLevel?: number;
  quantityReserved?: number;
}) {
  const organizationId = await getCurrentUserActiveOrganizationId();

  const result = await updateInventorySettings({ ...data, organizationId });
  if (!result.success) throw new Error(result.message);

  revalidatePath("/inventory");
  return result;
}
