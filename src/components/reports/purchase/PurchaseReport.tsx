"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, DollarSign, Users, Package } from "lucide-react";
import { fetchFullPurchaseReport } from "@/actions/reports/purchaseReport";
import PurchaseBySupplier from "./PurchaseBySupplier";
import PurchaseByProduct from "./PurchaseByProduct";
import { PurcahseLineChart } from "./PurchaseLineChart";

type BasicPurchaseReport = {
  totalPurchaseAmount: number;
  totalOrders: number;
  uniqueSuppliers: number;
  totalItems: number;
  dailyTotals: { date: string; total: number }[];
};

type SupplierReportItem = { supplier: string; total: number }[];
type ProductReportItem = { product: string; total: number }[];

type FullPurchaseReport = {
  basicReport: BasicPurchaseReport | null;
  supplierReport: SupplierReportItem | null;
  productReport: ProductReportItem | null;
};

export default function PurchaseReport({
  initialReport,
  defaultStartDate,
  defaultEndDate,
  dateRange,
}: {
  initialReport: FullPurchaseReport | null;
  defaultStartDate: Date;
  defaultEndDate: Date;
  dateRange: { startDate: Date; endDate: Date };
}) {
  const [purchaseReport, setPurchaseReport] = useState(initialReport);

  useEffect(() => {
    if (
      dateRange.startDate.toISOString() === defaultStartDate.toISOString() &&
      dateRange.endDate.toISOString() === defaultEndDate.toISOString()
    ) {
      return;
    }
    fetchFullPurchaseReport({
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
    }).then(setPurchaseReport);
  }, [dateRange, defaultStartDate, defaultEndDate]);

  if (!purchaseReport) return <p>Loading...</p>;

  const cardData = [
    {
      title: "Total Purchase Amount",
      value: purchaseReport.basicReport?.totalPurchaseAmount ?? 0,
      icon: DollarSign,
      format: (value: number) =>
        `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: "Total Orders",
      value: purchaseReport.basicReport?.totalOrders ?? 0,
      icon: FileText,
    },
    {
      title: "Unique Suppliers",
      value: purchaseReport.basicReport?.uniqueSuppliers ?? 0,
      icon: Users,
    },
    {
      title: "Total Items Purchased",
      value: purchaseReport.basicReport?.totalItems ?? 0,
      icon: Package,
    },
  ];

  return (
    <div className="flex-1 space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {cardData.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card key={idx}>
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle>{card.title}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {card.format ? card.format(card.value) : card.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-1">
        {purchaseReport?.basicReport?.dailyTotals?.length ? (
          <PurcahseLineChart data={purchaseReport?.basicReport?.dailyTotals} />
        ) : (
          <div className="flex items-center justify-center h-[420px] text-gray-500 text-sm">
            No Purchase data available
          </div>
        )}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {purchaseReport?.supplierReport?.length ? (
          <PurchaseBySupplier data={purchaseReport?.supplierReport} />
        ) : (
          <div className="flex items-center justify-center h-[420px] text-gray-500 text-sm">
            No Suuplier data available
          </div>
        )}
        {purchaseReport?.productReport?.length ? (
          <PurchaseByProduct data={purchaseReport?.productReport} dateRange={dateRange} />
        ) : (
          <div className="flex items-center justify-center h-[420px] text-gray-500 text-sm">
            No Product data available
          </div>
        )}
      </div>
    </div>
  );
}
