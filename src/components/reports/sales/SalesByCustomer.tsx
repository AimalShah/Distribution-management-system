"use client";

import {
  Cell,
  Tooltip,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface SalesByCustomerData {
  customer: string;
  total: number;
}

interface SalesByCustomerType {
  data: SalesByCustomerData[];
}

const chartConfig: Record<string, { label: string; color: string }> = {
  sales: {
    label: "Sales",
    color: "#3b82f6",
  },
};
const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#A28FD0",
  "#FF6699",
  "#33CCFF",
  "#FF9933",
  "#66FF66",
];
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  outerRadius,
  percent,
  index,
  payload,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  percent: number;
  index: number;
  payload: { customer: string; total: number };
}) => {
  const RADIAN = Math.PI / 180;
  // Positioning label outside the pie slice
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Only show labels for slices >= 3% for clarity
  if (percent < 0.03) return null;

  return (
    <>
      <path
        d={`M${cx + outerRadius * Math.cos(-midAngle * RADIAN)},${
          cy + outerRadius * Math.sin(-midAngle * RADIAN)
        }L${x},${y}`}
        stroke={COLORS[index % COLORS.length]}
        fill="none"
      />
      <text
        x={x}
        y={y}
        fill="#374151"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="600"
      >
        {payload.customer}
      </text>
    </>
  );
};

export default function SalesByCustomerChart({ data }: SalesByCustomerType) {
  const totalSales = data.reduce((sum, sale) => sum + sale.total, 0);

  const chartData = data.map((sale) => ({
    ...sale,
    name: sale.customer,
    total: sale.total,
    fill: chartConfig[sale.customer]?.color || "#3b82f6",
  }));
  if (!data || data.length === 0) {
    return (
      <Card className="shadow-sm border border-gray-200 rounded-xl">
        <CardHeader className="pb-2 border-b border-gray-100">
          <CardTitle>Sale By Customer</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80 text-gray-500">
          No customer data available
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle>Sales by Customer</CardTitle>
        <CardDescription>
          A pie chart showing the percentage of sales for each customer.
        </CardDescription>
      </CardHeader>

      <CardContent style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="total"
              nameKey="customer"
              cx="50%"
              cy="50%"
              innerRadius={60} 
              outerRadius={100}
              fill="#8884d8"
              labelLine={false}
              label={renderCustomizedLabel}
              animationDuration={800}
              animationEasing="ease-in-out"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="#fff"
                  strokeWidth={1}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(totalSales: number) =>
                `$${totalSales.toLocaleString()}`
              }
              contentStyle={{ backgroundColor: "#f9fafb", borderRadius: 6 }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              wrapperStyle={{ fontSize: 14, color: "#374151" }}
              iconSize={12}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
