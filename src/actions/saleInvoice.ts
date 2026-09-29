"use server";

import {
  getCurrentUser,
  getCurrentUserActiveOrganizationId,
} from "@/actions/user";
import {
  addSaleInvoice,
  deleteSaleInvoice,
  getSaleByCustomer,
  getSaleInvoices,
  updateSaleInvoice,
} from "@/services/saleInvoice";
import { SaleInvoiceFormData } from "@/types/saleInvoice";
import { revalidatePath } from "next/cache";

export async function createSaleInvoice(data: SaleInvoiceFormData) {
  const organizationId = await getCurrentUserActiveOrganizationId();
  const { curntUser } = await getCurrentUser();

  const result = await addSaleInvoice(data, organizationId, curntUser.id);
  revalidatePath("/sale-invoice");
  revalidatePath("/invoices");

  return result;
}

export async function fetchSalesInvoices() {
  const organizationId = await getCurrentUserActiveOrganizationId();
  const result = await getSaleInvoices(organizationId);
  return result;
}

export async function getSalesInvoicesByCustomer(customerId: string) {
  return await getSaleByCustomer(customerId);
}

export async function editSaleInvoice(
  id: string,
  data: Partial<SaleInvoiceFormData>
) {
  const result = await updateSaleInvoice(id, data);
  if (!result.success) throw new Error(result.message);

  revalidatePath("/sales");
  return result;
}

export async function removeSaleInvoice(id: string) {
  const result = await deleteSaleInvoice(id);
  if (!result.success) throw new Error(result.message);

  revalidatePath("/sales");
  return result;
}
