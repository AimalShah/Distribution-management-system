"use client";

import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SupplierData {
  supplier: string;
  total: number;
}

interface PurchaseBySupplierProps {
  data: SupplierData[];
}

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
  payload: { supplier: string; total: number };
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
        d={`M${cx + outerRadius * Math.cos(-midAngle * RADIAN)},${cy +
          outerRadius * Math.sin(-midAngle * RADIAN)}L${x},${y}`}
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
        {payload.supplier}
      </text>
    </>
  );
};

export default function PurchaseBySupplier({ data }: PurchaseBySupplierProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="shadow-sm border border-gray-200 rounded-xl">
        <CardHeader className="pb-2 border-b border-gray-100">
          <CardTitle>Purchase By Supplier</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80 text-gray-500">
          No supplier data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border border-gray-200 rounded-xl">
      <CardHeader className="pb-2 border-b border-gray-100">
        <CardTitle>Purchase By Supplier</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="supplier"
              cx="50%"
              cy="50%"
              innerRadius={60} // donut hole radius
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
              formatter={(value: number) => `$${value.toLocaleString()}`}
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
