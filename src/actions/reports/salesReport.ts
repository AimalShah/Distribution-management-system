"use server";

import { 
  getBasicSalesReport, 
  getSalesByCustomer, 
  getSalesByProduct 
} from "@/services/reports/salesReport";

export async function fetchBasicSalesReport(params: { startDate: string; endDate: string }) {
  return await getBasicSalesReport(params.startDate, params.endDate);
}

export async function fetchSalesByCustomer(params: { startDate: string; endDate: string }) {
  return await getSalesByCustomer(params.startDate, params.endDate);
}

export async function fetchSalesByProduct(params: { startDate: string; endDate: string }) {
  return await getSalesByProduct(params.startDate, params.endDate);
}

export async function fetchFullSalesReport(params: { startDate: string; endDate: string }) {
  const [basic, customers, products] = await Promise.all([
    fetchBasicSalesReport({startDate: params.startDate, endDate:params.endDate}),
    fetchSalesByCustomer({startDate: params.startDate, endDate:params.endDate}),
    fetchSalesByProduct({startDate: params.startDate, endDate:params.endDate}),
  ]);

  return { basic, customers, products };
}
