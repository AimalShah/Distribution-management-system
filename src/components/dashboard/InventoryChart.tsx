"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";

type InventoryItem = {
  id: string;
  quantityOnHand: number;
  reorderLevel: number;
  product: {
    id: string;
    name: string;
    productCode: string;
  } | null;
};

interface InventoryChartProps {
  data: InventoryItem[];
}

export function InventoryChart({ data }: InventoryChartProps) {
  const chartData = data
    .sort((a, b) => b.quantityOnHand - a.quantityOnHand)
    .slice(0, 10)
    .map((item) => ({
      name: item.product?.name || "Unknown Product",
      quantity: item.quantityOnHand || 0,
      reorderLevel: item.reorderLevel || 10,
      status: item.quantityOnHand <= (item.reorderLevel || 10) ? "Low" : "Good",
    }));

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="text-lg font-medium">No inventory data available</div>
          <div className="text-sm">Inventory data will appear here once you have products</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis 
            dataKey="name" 
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            }}
            formatter={(value: number, name: string) => [
              value,
              name === "quantity" ? "Quantity" : "Reorder Level"
            ]}
          />
          <Bar
            dataKey="quantity"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="reorderLevel"
            fill="#f59e0b"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      
      <div className="flex items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-slate-600">Current Stock</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span className="text-slate-600">Reorder Level</span>
        </div>
      </div>
    </div>
  );
}
