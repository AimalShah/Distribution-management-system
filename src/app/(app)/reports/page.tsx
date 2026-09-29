import { fetchFullInventoryReports } from "@/actions/reports/inventoryReport";
import { fetchFullPurchaseReport } from "@/actions/reports/purchaseReport";
import { fetchFullSalesReport } from "@/actions/reports/salesReport";
import ReportClient from "@/components/reports/ReportClient";
export default async function ReportsPage() {
  const defaultStartDate = new Date();
  defaultStartDate.setMonth(defaultStartDate.getMonth() - 1);
  const defaultEndDate = new Date();

  const salesReport = await fetchFullSalesReport({
    startDate: defaultStartDate.toISOString(),
    endDate: defaultEndDate.toISOString(),
  });
  const purchaseReport = await fetchFullPurchaseReport({
    startDate: defaultStartDate.toISOString(),
    endDate: defaultEndDate.toISOString(),
  });
  const inventoryReport = await fetchFullInventoryReports({
    startDate: defaultStartDate.toISOString(),
    endDate: defaultEndDate.toISOString(),
  });
  const initialReport = {
    salesReport,
    purchaseReport,
    inventoryReport
  };

  return (
    <ReportClient
      initialReport={initialReport}
      defaultStartDate={defaultStartDate}
      defaultEndDate={defaultEndDate}
    />
  );
}
