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

type ProductSalesData = {
  product: string;
  total: number;
};

type Props = {
  data?: ProductSalesData[];
  dateRange: DateRange;
};

const chartConfig = {
  total: {
    label: "Total Sales",
    color: "#3b82f6",
  },
} satisfies ChartConfig;

export default function SalesByProduct({ data, dateRange }: Props) {
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

  const products = React.useMemo(() => data ?? [], [data]);

  const totalSales = React.useMemo(
    () => products.reduce((acc, curr) => acc + curr.total, 0),
    [products]
  );

  const topProduct = React.useMemo<ProductSalesData | undefined>(
    () =>
      products.reduce<ProductSalesData | undefined>(
        (max, product) => (max && product.total > max.total ? product : max),
        undefined
      ),
    [products]
  );

  const topProductName = topProduct?.product ?? "-";

  const growthPercentage = React.useMemo(() => {
    if (!topProduct || products.length === 0) return "0.0";
    const avgSales = totalSales / products.length;
    if (!avgSales) return "0.0";
    const variation = ((topProduct.total - avgSales) / avgSales) * 100;
    return Math.abs(variation).toFixed(1);
  }, [totalSales, topProduct, products.length]);

  const sortedData = React.useMemo(
    () => [...products].sort((a, b) => b.total - a.total),
    [products]
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4 space-y-1">
        <CardTitle className="text-xl font-semibold text-gray-900">
          Sales by Product
        </CardTitle>
        <CardDescription className="text-sm text-gray-500">
          {dateRangeText}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gray-50/50 rounded-lg border border-gray-100">
            <div className="text-sm font-bold text-gray-900 mb-1 truncate">
              ${totalSales?.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Total Sales
            </div>
          </div>
          <div className="text-center p-4 bg-blue-50/50 rounded-lg border border-blue-100">
            <div className="text-sm font-bold text-blue-900 mb-1 truncate">
              {topProductName}
            </div>
            <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">
              Top Seller
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50/50 rounded-lg border border-gray-100">
            <div className="text-sm font-bold text-gray-900 mb-1">
              {products.length}
            </div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Products
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
                stroke="#f0f0f0"
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
                tickFormatter={(value) => `${value}`}
                width={60}
              />
              <ChartTooltip
                cursor={{ fill: "rgba(59, 130, 246, 0.1)", radius: 4 }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    className="bg-white border border-gray-200 shadow-lg rounded-lg p-3"
                    formatter={(value, name) => [
                      `${value.toLocaleString()}`,
                      "Sales",
                    ]}
                  />
                }
              />
              <Bar
                dataKey="total"
                fill="#3b82f6"
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
            {topProductName} leading by {growthPercentage}%
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
