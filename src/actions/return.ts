"use server";

import {
  getCurrentUser,
  getCurrentUserActiveOrganizationId,
} from "@/actions/user";
import prisma from "@/lib/prisma";
import {
  addReturn,
  deleteReturn,
  getReturnById,
  getReturns,
  updateReturn,
} from "@/services/return";
import { ReturnFormData } from "@/types/return";
import { revalidatePath } from "next/cache";

export async function createReturn(data: ReturnFormData) {
  const { curntUser } = await getCurrentUser();

  const organizationId = await getCurrentUserActiveOrganizationId();
  const result = await addReturn(data, organizationId, curntUser.id);
  revalidatePath("/returns");

  return result;
}

export async function fetchReturns() {
  const organizationId = await getCurrentUserActiveOrganizationId();

  const result = await getReturns(organizationId);
  return result;
}

export async function fetchReturn(id: string) {
  const result = await getReturnById(id);
  return result;
}

export async function editReturn(id: string, data: Partial<ReturnFormData>) {
  const result = await updateReturn(id, data);
  if (!result.success) throw new Error(result.message);

  revalidatePath("/returns");
  return result;
}

export async function removeReturn(id: string) {
  const result = await deleteReturn(id);
  if (!result.success) throw new Error(result.message);

  revalidatePath("/returns");
  return result;
}
