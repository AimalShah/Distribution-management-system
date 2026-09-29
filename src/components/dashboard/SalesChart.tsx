"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { format } from "date-fns";

type SaleInvoice = {
  id: string;
  saleDate: Date;
  createdAt: Date;
  totalAmount: number;
};

interface SalesChartProps {
  data: SaleInvoice[];
}

export function SalesChart({ data }: SalesChartProps) {
  const chartData = data.map((sale) => ({
    date: format(new Date(sale.saleDate || sale.createdAt), "MMM dd"),
    sales: sale.totalAmount,
    orders: 1,
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="text-lg font-medium">No sales data available</div>
          <div className="text-sm">Sales data will appear here once you have transactions</div>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          dataKey="date" 
          stroke="#64748b"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          stroke="#64748b"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value.toLocaleString()}`}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
          formatter={(value: number, name: string) => [
            name === "sales" ? `$${value.toLocaleString()}` : value,
            name === "sales" ? "Sales" : "Orders"
          ]}
        />
        <Line
          type="monotone"
          dataKey="sales"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
