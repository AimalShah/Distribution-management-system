"use server";

import { getCurrentUserActiveOrganizationId } from "@/actions/user";
import {
  addCustomer,
  deleteCustomer,
  getCustomerById,
  getCustomers,
  updateCustomer,
} from "@/services/customer";
import { CustomerFormData } from "@/types/customer";
import { revalidatePath } from "next/cache";

export async function createCustomer(data: CustomerFormData) {
  const organizationId = await getCurrentUserActiveOrganizationId();

  const result = await addCustomer(data, organizationId);
  if (result.success) {
    revalidatePath("/customer");
    revalidatePath("/invoices");
  }
  return result;
}

export async function fetchCustomers() {
  const organizationId = await getCurrentUserActiveOrganizationId();
  const result = await getCustomers(organizationId);

  return result;
}

export async function fetchCustomer(id: string) {
  const result = await getCustomerById(id);

  return result;
}

export async function editCustomer(
  id: string,
  data: Partial<CustomerFormData>
) {
  const result = await updateCustomer(id, data);
  if (result.success) {
    revalidatePath("/customer");
    revalidatePath("/invoices");
  }
  return result;
}

export async function removeCustomer(id: string) {
  const result = await deleteCustomer(id);
  if (result.success) revalidatePath("/product");
  return result;
}
