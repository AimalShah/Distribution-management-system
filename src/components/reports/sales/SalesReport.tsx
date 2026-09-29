"use client";

import { useState, useEffect } from "react";
import { fetchFullSalesReport } from "@/actions/reports/salesReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { FileText, DollarSign } from "lucide-react";
import SalesByCustomer from "@/components/reports/sales/SalesByCustomer";
import SalesByProduct from "./SalesByProduct";
import { SalesLineChartInteractive } from "./SalesLineChart";

type BasicSalesReport = {
  totalSales: number;
  totalOrders: number;
  uniqueCustomers: number;
  totalItems: number;
  dailyTotals: { date: string; total: number }[];
};

type CustomerReportItem = { customer: string; total: number }[];
type ProductReportItem = { product: string; total: number }[];

type FullSalesReport = {
  basic: BasicSalesReport | null;
  customers: CustomerReportItem | null;
  products: ProductReportItem | null;
};

export default function SalesReport({
  initialReport,
  defaultStartDate,
  defaultEndDate,
  dateRange,
}: {
  initialReport: FullSalesReport | null;
  defaultStartDate: Date;
  defaultEndDate: Date;
  dateRange: { startDate: Date; endDate: Date };
}) {
  const [saleReport, setSaleReport] = useState(initialReport);
  useEffect(() => {
    if (
      dateRange.startDate.toISOString() === defaultStartDate.toISOString() &&
      dateRange.endDate.toISOString() === defaultEndDate.toISOString()
    ) {
      return;
    }

    fetchFullSalesReport({
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
    }).then(setSaleReport);
  }, [dateRange, defaultStartDate, defaultEndDate]);

  const cardData: CardData[] = [
    {
      title: "Total Sales",
      value: saleReport?.basic?.totalSales ?? 0,
      icon: DollarSign,
      format: (value) => `$${value.toLocaleString()}`,
    },
    {
      title: "Total Orders",
      value: saleReport?.basic?.totalOrders ?? 0,
      icon: FileText,
    },
    {
      title: "Total Customer",
      value: saleReport?.basic?.uniqueCustomers ?? 0,
      icon: FileText,
    },
    {
      title: "Total Product",
      value: saleReport?.products?.length ?? 0,
      icon: FileText,
    },
  ];

  return (
    <div className="flex-1 space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cardData.map((card, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {card.format && typeof card.value === "number"
                  ? card.format(card.value)
                  : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-1">
        {saleReport?.basic?.dailyTotals?.length ? (
          <SalesLineChartInteractive data={saleReport?.basic?.dailyTotals} />
        ) : (
          <div className="flex items-center justify-center h-[420px] text-gray-500 text-sm">
            No sales data available
          </div>
        )}
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {saleReport?.customers?.length ? (
          <div className="w-full h-[420px]">
            <SalesByCustomer data={saleReport.customers} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-[420px] text-gray-500 text-sm">
            No Customer data available
          </div>
        )}
        {saleReport?.products?.length ? (
          <div className="w-full h-[420px]">
            <SalesByProduct
              dateRange={dateRange}
              data={saleReport?.products ?? []}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-[420px] text-gray-500 text-sm">
            No Product data available
          </div>
        )}
      </div>
    </div>
  );
}
