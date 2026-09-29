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

type ProductPurchaseData = {
  product: string;
  total: number; 
};

type Props = {
  data?: ProductPurchaseData[];
  dateRange: DateRange;
};

const chartConfig = {
  total: {
    label: "Total Purchases",
    color: "#10b981", 
  },
} satisfies ChartConfig;

export default function PurchaseByProduct({ data = [], dateRange }: Props) {
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

  const totalPurchases = React.useMemo(
    () => data.reduce((acc, curr) => acc + curr.total, 0),
    [data]
  );

  const topProduct = React.useMemo(() => {
    if (data.length === 0) return { product: "-", total: 0 };
    return data.reduce(
      (max, product) => (product.total > max.total ? product : max),
      data[0]
    );
  }, [data]);

  const growthPercentage = React.useMemo(() => {
    if (data.length === 0) return "0.0";
    const avgPurchase = totalPurchases / data.length;
    const variation = ((topProduct.total - avgPurchase) / avgPurchase) * 100;
    return Math.abs(variation).toFixed(1);
  }, [totalPurchases, topProduct, data.length]);

  const sortedData = React.useMemo(
    () => [...data].sort((a, b) => b.total - a.total),
    [data]
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4 space-y-1">
        <CardTitle className="text-xl font-semibold text-gray-900">
          Purchases by Product
        </CardTitle>
        <CardDescription className="text-sm text-gray-500">
          {dateRangeText}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gray-50/50 rounded-lg border border-gray-100">
            <div className="text-sm font-bold text-gray-900 mb-1 truncate">
              ${totalPurchases.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Total Purchases
            </div>
          </div>
          <div className="text-center p-4 bg-green-50/50 rounded-lg border border-green-100">
            <div className="text-sm font-bold text-green-900 mb-1 truncate">
              {topProduct.product}
            </div>
            <div className="text-xs font-medium text-green-600 uppercase tracking-wide">
              Top Purchased Product
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50/50 rounded-lg border border-gray-100">
            <div className="text-sm font-bold text-gray-900 mb-1">
              {data.length}
            </div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Products Purchased
            </div>
          </div>
        </div>

        <div className="mt-8">
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <BarChart
              accessibilityLayer
              data={sortedData}
              margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                opacity={0.6}
              />
              <XAxis
                dataKey="product"
                tickLine={false}
                tickMargin={12}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickFormatter={(value) =>
                  value.length > 10 ? `${value.slice(0, 10)}...` : value
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
                width={70}
              />
              <ChartTooltip
                cursor={{ fill: "rgba(16, 185, 129, 0.1)", radius: 4 }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    className="bg-white border border-gray-200 shadow-lg rounded-lg p-3"
                    formatter={(value) => [`$${value.toLocaleString()}`, "Purchases"]}
                  />
                }
              />
              <Bar
                dataKey="total"
                fill="#10b981"
                radius={[6, 6, 0, 0]}
                className="hover:opacity-80 transition-opacity"
              />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>

      <CardFooter className="pt-4 border-t border-gray-100 bg-gray-50/30">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            {topProduct.product} leading by {growthPercentage}%
            <TrendingUp className="h-4 w-4 text-green-600 ml-1" />
          </div>
          <div className="text-xs text-gray-500">
            Updated for selected period
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
