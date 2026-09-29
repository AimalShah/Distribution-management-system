"use client";

import SalesReport from "@/components/reports/sales/SalesReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range";
import { useEffect, useState } from "react";
import PurchaseReport from "./purchase/PurchaseReport";
import InventoryReport from "./inventory/InventoryReport";

type DateRange = {
  startDate: Date;
  endDate: Date;
};

type ReportInitialData = {
  salesReport?: {
    basic: { totalSales: number; totalOrders: number; uniqueCustomers: number; totalItems: number; dailyTotals: { date: string; total: number }[] } | null;
    customers: { customer: string; total: number }[] | null;
    products: { product: string; total: number; quantity?: number }[] | null;
  };
  purchaseReport?: {
    basicReport?: { totalPurchaseAmount: number; totalOrders: number; uniqueSuppliers: number; totalItems: number; dailyTotals: { date: string; total: number }[] };
    supplierReport?: { supplier: string; total: number }[];
    productReport?: { product: string; total: number }[];
  };
  inventoryReport?: Record<string, unknown>;
};

export default function ReportClient({
  initialReport,
  defaultStartDate,
  defaultEndDate,
}: {
  initialReport: ReportInitialData | null;
  defaultStartDate: Date;
  defaultEndDate: Date;
}) {
  const [period, setPeriod] = useState("monthly");
  const [dateRange, setDateRange] = useState({
    startDate: defaultStartDate,
    endDate: defaultEndDate,
  });

  useEffect(() => {
    const now = new Date();
    let start: Date;
    let end = new Date();

    switch (period) {
      case "daily":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(start);
        break;
      case "weekly":
        start = new Date();
        start.setDate(now.getDate() - 7);
        break;
      case "monthly":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "yearly":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date();
    }
    setDateRange({ startDate: start, endDate: end });
  }, [period]);
  console.log("inve", initialReport?.inventoryReport);
  return (
    <div className="flex-1 space-y-4 p-5 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Reports & Analytics
        </h2>
      </div>

      <div className="flex items-center space-x-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>

        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>
      <Tabs defaultValue="salesReport">
        <TabsList>
          <TabsTrigger value="salesReport">Sales Report</TabsTrigger>
          <TabsTrigger value="purchaseReport">Purchase Report</TabsTrigger>
          <TabsTrigger value="inventoryReport">Inventory Report</TabsTrigger>
        </TabsList>
        <TabsContent value="salesReport">
          <SalesReport
            initialReport={initialReport?.salesReport ?? null}
            defaultStartDate={defaultStartDate}
            defaultEndDate={defaultEndDate}
            dateRange={dateRange}
          />
        </TabsContent>
        <TabsContent value="purchaseReport">
          <PurchaseReport
            initialReport={initialReport?.purchaseReport ?? null}
            defaultStartDate={defaultStartDate}
            defaultEndDate={defaultEndDate}
            dateRange={dateRange}
          />
        </TabsContent>
        <TabsContent value="inventoryReport">
          <InventoryReport
            initialReport={initialReport?.inventoryReport ?? null}
            defaultStartDate={defaultStartDate}
            defaultEndDate={defaultEndDate}
            dateRange={dateRange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
