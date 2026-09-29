"use client";

import * as React from "react";
import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type DateRange = {
  startDate: Date;
  endDate: Date;
};

type StockItem = {
  id: string;
  name: string;
  costPrice: number;
  totalQuantity: number;
  totalValue: number;
  reorderLevel: number;
};

type Props = {
  data?: StockItem[];
  dateRange: DateRange;
};

const chartConfig = {
  totalValue: {
    label: "Total Value",
    color: "#10b981",
  },
} satisfies ChartConfig;

export default function StockValuationReport({ data = [], dateRange }: Props) {
  const sampleData: StockItem[] = [
    {
      id: "cme3zwjh2004tpw4k9tbkd8e3",
      name: "Small Concrete Salad",
      costPrice: 1199.92,
      totalQuantity: 15,
      totalValue: 17998.82,
      reorderLevel: 34,
    },
    {
      id: "sample2",
      name: "Premium Office Chair",
      costPrice: 850.5,
      totalQuantity: 8,
      totalValue: 6804.0,
      reorderLevel: 10,
    },
    {
      id: "sample3",
      name: "Wireless Headphones",
      costPrice: 299.99,
      totalQuantity: 25,
      totalValue: 7499.75,
      reorderLevel: 15,
    },
    {
      id: "sample4",
      name: "Standing Desk",
      costPrice: 450.0,
      totalQuantity: 12,
      totalValue: 5400.0,
      reorderLevel: 5,
    },
    {
      id: "sample5",
      name: "LED Monitor",
      costPrice: 320.75,
      totalQuantity: 18,
      totalValue: 5773.5,
      reorderLevel: 8,
    },
  ];

  const stockData = data.length > 0 ? data : sampleData;

  const dateRangeText = React.useMemo(() => {
    const start = dateRange.startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const end = dateRange.endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${start} - ${end}`;
  }, [dateRange]);

  const totalInventoryValue = React.useMemo(
    () => stockData.reduce((acc, curr) => acc + curr.totalValue, 0),
    [stockData]
  );

  const highestValueItem = React.useMemo(() => {
    if (stockData.length === 0) return { name: "-", totalValue: 0 };
    return stockData.reduce(
      (max, item) => (item.totalValue > max.totalValue ? item : max),
      stockData[0]
    );
  }, [stockData]);

  const growthPercentage = React.useMemo(() => {
    if (stockData.length === 0) return "0.0";
    const avgValue = totalInventoryValue / stockData.length;
    const variation =
      ((highestValueItem.totalValue - avgValue) / avgValue) * 100;
    return Math.abs(variation).toFixed(1);
  }, [totalInventoryValue, highestValueItem, stockData.length]);

  const sortedData = React.useMemo(
    () =>
      [...stockData].sort((a, b) => b.totalValue - a.totalValue).slice(0, 10), // Show top 10 items
    [stockData]
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4 space-y-1">
        <CardTitle>Stock Valuation Report</CardTitle>
        <CardDescription>{dateRangeText}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Top Items by Value
          </h3>
        </div>
        <ChartContainer config={chartConfig} className="h-[320px] w-full">
          <BarChart
            accessibilityLayer
            data={sortedData}
            margin={{ left: 60, right: 20, top: 20, bottom: 60 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              opacity={0.6}
            />
            <XAxis
              dataKey="name"
              tickLine={false}
              tickMargin={12}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              angle={-45}
              textAnchor="end"
              height={60}
              tickFormatter={(value) =>
                value.length > 15 ? `${value.slice(0, 15)}...` : value
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              width={60}
            />
            <ChartTooltip
              cursor={{ fill: "rgba(16, 185, 129, 0.1)", radius: 4 }}
              content={
                <ChartTooltipContent
                  hideLabel
                  className="bg-white border border-gray-200 shadow-lg rounded-lg p-3"
                  formatter={(value, name, props) => {
                    const item = props.payload;
                    return [
                      <div key="tooltip" className="space-y-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-600">
                          Value: $
                          {item.totalValue.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </div>
                        <div className="text-sm text-gray-600">
                          Quantity: {item.totalQuantity} units
                        </div>
                        <div className="text-sm text-gray-600">
                          Unit Price: ${item.costPrice.toFixed(2)}
                        </div>
                      </div>,
                    ];
                  }}
                />
              }
            />
            <Bar
              dataKey="totalValue"
              fill="#10b981"
              radius={[6, 6, 0, 0]}
              className="hover:opacity-80 transition-opacity"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>

      <CardFooter className="pt-4 border-t border-gray-100 bg-gray-50/30">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            {highestValueItem.name} leading by {growthPercentage}%
            <TrendingUp className="h-4 w-4 text-green-600 ml-1" />
          </div>
          <div className="text-xs text-gray-500">
            Showing top {Math.min(10, stockData.length)} items by value
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
