"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  Package,
  AlertTriangle,
  Layers,
} from "lucide-react";
import StockValuationReport from "./StockValuationReport";
import { fetchFullInventoryReports } from "@/actions/reports/inventoryReport";
import InventoryMovementReport from "./InventoryMovementReport";
import type {
  BasicInventoryReportItem,
  InventoryMovementReportItem,
  StockValuationReportItem,
} from "@/services/reports/inventoryReport";

type DateRange = {
  startDate: Date;
  endDate: Date;
};

type FullInventoryReport = {
  basicInventoryReport: BasicInventoryReportItem[];
  inventoryMovementReport: InventoryMovementReportItem[];
  stockValuationReport: StockValuationReportItem[];
};

export default function InventoryReport({
  initialReport,
  defaultStartDate,
  defaultEndDate,
  dateRange,
}: {
  initialReport?: FullInventoryReport;
  defaultStartDate: Date;
  defaultEndDate: Date;
  dateRange: DateRange;
}) {
  const [inventoryReport, setInventoryReport] = useState<
    FullInventoryReport | undefined
  >(initialReport);

  useEffect(() => {
    if (
      dateRange.startDate.toISOString() === defaultStartDate.toISOString() &&
      dateRange.endDate.toISOString() === defaultEndDate.toISOString()
    ) {
      return;
    }
    fetchFullInventoryReports({
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
    }).then(setInventoryReport);
  }, [dateRange, defaultStartDate, defaultEndDate]);

  if (!inventoryReport) return <p>Loading...</p>;

  const basicInventory = inventoryReport.basicInventoryReport || [];

  // Aggregate metrics from basicInventory
  const totalInventoryValue = basicInventory.reduce(
    (sum, item) => sum + (item.totalValue || 0),
    0
  );
  const totalItemsInStock = basicInventory.reduce(
    (sum, item) => sum + (item.totalQuantity || 0),
    0
  );
  const lowStockItems = basicInventory.filter(
    (item) => (item.totalQuantity || 0) <= (item.reorderLevel || 0)
  ).length;
  const uniqueProducts = basicInventory.length;

  // Card config
  const inventoryCardData = [
    {
      title: "Total Inventory Value",
      value: totalInventoryValue,
      icon: DollarSign,
      format: (value: number) =>
        `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: "Total Items in Stock",
      value: totalItemsInStock,
      icon: Package,
    },
    {
      title: "Low Stock Items",
      value: lowStockItems,
      icon: AlertTriangle,
    },
    {
      title: "Unique Products",
      value: uniqueProducts,
      icon: Layers,
    },
  ];

  return (
    <div className="flex-1 space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {inventoryCardData.map((card, idx) => {
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
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {inventoryReport.inventoryMovementReport.length ? (
          <InventoryMovementReport
            data={inventoryReport.inventoryMovementReport}
            dateRange={dateRange}
          />
        ) : (
          <div className="flex items-center justify-center h-[420px] text-gray-500 text-sm">
            No Inventory movement data available
          </div>
        )}
        {inventoryReport.stockValuationReport.length ? (
          <StockValuationReport
            data={inventoryReport.stockValuationReport}
            dateRange={dateRange}
          />
        ) : (
          <div className="flex items-center justify-center h-[420px] text-gray-500 text-sm">
            No Stock data available
          </div>
        )}
      </div>
    </div>
  );
}
