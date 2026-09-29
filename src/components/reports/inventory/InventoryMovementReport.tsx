"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState } from "react";
import { format } from "date-fns";
type DateRange = {
  startDate: Date;
  endDate: Date;
};
export const description = "Inventory movement bar chart";

type InventoryMovementLog = {
  id: string;
  product: { id: string; name: string } | null;
  movementType: "IN" | "OUT" | "ADJUSTMENT" | "TRANSFER" | "RETURN" | "DAMAGED" | "EXPIRED";
  quantity: number;
  createdAt: Date;
  reference: string | null;
};

const chartConfig = {
  IN: { label: "In", color: "var(--chart-2)" },
  OUT: { label: "Out", color: "var(--chart-1)" },
  ADJUSTMENT: { label: "Adjustment", color: "var(--chart-3)" },
  TRANSFER: { label: "Transfer", color: "var(--chart-4)" },
  RETURN: { label: "Return", color: "var(--chart-5)" },
  DAMAGED: { label: "Damaged", color: "var(--chart-6)" },
  EXPIRED: { label: "Expired", color: "var(--chart-7)" },
} satisfies ChartConfig;

function transformInventoryData(rawData: InventoryMovementLog[]) {
  const grouped: Record<string, Record<string, number>> = {};
  rawData.forEach((item) => {
    const month = format(new Date(item.createdAt), "MMMM");
    if (!grouped[month]) {
      grouped[month] = { month };
      Object.keys(chartConfig).forEach((type) => {
        grouped[month][type] = 0;
      });
    }
    grouped[month][item.movementType] += item.quantity;
  });

  return Object.values(grouped);
}

export default function InventoryMovementReport({
  data,
  dateRange,
}: {
  data: InventoryMovementLog[];
  dateRange: DateRange;
}) {
  const [movementType, setMovementType] = useState("All");

  const chartData = useMemo(() => transformInventoryData(data), [data]);
  const filteredData = useMemo(() => {
    if (movementType === "All") return chartData;
    return chartData.map((monthData: Record<string, number | string>) => ({
      month: monthData.month,
      [movementType]: monthData[movementType],
    }));
  }, [movementType, chartData]);

  const dateRangeText = useMemo(() => {
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Movements</CardTitle>
        <CardDescription>Showing {dateRangeText}</CardDescription>
        <Select value={movementType} onValueChange={setMovementType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            {Object.keys(chartConfig).map((key) => (
              <SelectItem key={key} value={key}>
                {chartConfig[key as keyof typeof chartConfig].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartContainer config={chartConfig}>
            <BarChart data={filteredData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 3)}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              {movementType === "All" ? (
                Object.keys(chartConfig).map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={chartConfig[key as keyof typeof chartConfig].color}
                    radius={4}
                  />
                ))
              ) : (
                <Bar
                  dataKey={movementType}
                  fill={
                    chartConfig[movementType as keyof typeof chartConfig].color
                  }
                  radius={4}
                />
              )}
            </BarChart>
          </ChartContainer>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
