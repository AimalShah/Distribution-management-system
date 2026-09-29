"use server";

import {
  getBasicInventoryReport,
  getExpiryReport,
  getInventoryMovements,
  getLowStockReport,
  getStockValuationReport,
} from "@/services/reports/inventoryReport";

export async function fetchBasicInventoryReport(
  startDate: string,
  endDate: string
) {
  return await getBasicInventoryReport(startDate, endDate);
}

export async function fetchInventoryMovements(
  startDate: string,
  endDate: string
) {
  return await getInventoryMovements(startDate, endDate);
}

export async function fetchLowStockReport(startDate: string, endDate: string) {
  return await getLowStockReport(startDate, endDate);
}

export async function fetchStockValuationReport(
  startDate: string,
  endDate: string
) {
  return await getStockValuationReport(startDate, endDate);
}

export async function fetchExpiryReport(
  startDate: string,
  endDate: string,
  daysUntilExpiry?: number
) {
  return await getExpiryReport(startDate, endDate, daysUntilExpiry);
}

export async function fetchFullInventoryReports(params: {
  startDate: string;
  endDate: string;
}) {
  const [basicInventoryReport, inventoryMovementReport, stockValuationReport] =
    await Promise.all([
      fetchBasicInventoryReport(params.startDate, params.endDate),
      fetchInventoryMovements(params.startDate, params.endDate),
      fetchStockValuationReport(params.startDate, params.endDate),
    ]);

  return {
    basicInventoryReport,
    inventoryMovementReport,
    stockValuationReport,
  };
}
