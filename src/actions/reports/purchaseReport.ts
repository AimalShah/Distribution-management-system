"use server";

import {
  getBasicPurchaseReport,
  getPurchaseByProduct,
  getPurchaseBySupplier,
} from "@/services/reports/purchaseReport";

export async function fetchBasicPurchaseReport(params: {
  startDate: string;
  endDate: string;
}) {
  return await getBasicPurchaseReport(params.startDate, params.endDate);
}

export async function fetchPurchaseBySupplier(params: {
  startDate: string;
  endDate: string;
}) {
  return await getPurchaseBySupplier(params.startDate, params.endDate);
}

export async function fetchPurchaseByProduct(params: {
  startDate: string;
  endDate: string;
}) {
  return await getPurchaseByProduct(params.startDate, params.endDate);
}

export async function fetchFullPurchaseReport(params: {
  startDate: string;
  endDate: string;
}) {
  const [basicReport, supplierReport, productReport] = await Promise.all([
    fetchBasicPurchaseReport({
      startDate: params.startDate,
      endDate: params.endDate,
    }),
    fetchPurchaseBySupplier({
      startDate: params.startDate,
      endDate: params.endDate,
    }),
    fetchPurchaseByProduct({
      startDate: params.startDate,
      endDate: params.endDate,
    }),
  ]);

  return { basicReport, supplierReport, productReport };
}
