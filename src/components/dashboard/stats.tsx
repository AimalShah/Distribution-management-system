"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

interface DashboardData {
  totalSales: number;
  totalPurchases: number;
  totalCustomers: number;
  totalProducts: number;
  salesTrend: number;
  purchaseTrend: number;
}

type SaleInvoice = {
  id: string;
  totalAmount: number;
};

type Product = {
  id: string;
};

type Customer = {
  id: string;
};

type InventoryItem = {
  id: string;
};

type Purchase = {
  id: string;
  totalAmount: number;
};

export default function DashboardStats({
  saleInvoice,
  products,
  customers,
  inventory,
  purchases,
}: {
  saleInvoice: SaleInvoice[];
  products: Product[];
  customers: Customer[];
  inventory: InventoryItem[];
  purchases: Purchase[];
}) {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalSales: 0,
    totalPurchases: 0,
    totalCustomers: 0,
    totalProducts: 0,
    salesTrend: 0,
    purchaseTrend: 0,
  });
  useEffect(() => {
    if (saleInvoice && products && customers && inventory && purchases) {
      const sales = saleInvoice;

      const totalSales = sales.reduce(
        (sum: number, sale) => sum + sale.totalAmount,
        0
      );

      const totalPurchases = purchases.reduce(
        (sum: number, purchase) => sum + purchase.totalAmount,
        0
      );

      setDashboardData({
        totalSales,
        totalPurchases,
        totalCustomers: customers.length,
        totalProducts: products.length,
        salesTrend: 12.5,
        purchaseTrend: -2.3,
      });
    }
  }, [saleInvoice, products, customers, inventory, purchases]);

  const stats = [
    {
      title: "Total Sales",
      value: `$${dashboardData.totalSales.toLocaleString()}`,
      description: `${dashboardData.salesTrend > 0 ? "+" : ""}${dashboardData.salesTrend}% from last month`,
      trend: {
        value: dashboardData.salesTrend,
        isPositive: dashboardData.salesTrend > 0,
      },
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Purchases",
      value: `$${dashboardData.totalPurchases.toLocaleString()}`,
      description: `${dashboardData.purchaseTrend > 0 ? "+" : ""}${dashboardData.purchaseTrend}% from last month`,
      trend: {
        value: dashboardData.purchaseTrend,
        isPositive: dashboardData.purchaseTrend > 0,
      },
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Customers",
      value: dashboardData.totalCustomers.toString(),
      description: "Active customers",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Total Products",
      value: dashboardData.totalProducts.toString(),
      description: "Active products",
      icon: Package,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <>
      {stats.map((stat) => (
        <Card key={stat.title} className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {stat.value}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {stat.trend && (
                <div
                  className={`flex items-center text-xs ${
                    stat.trend.isPositive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {stat.trend.isPositive ? (
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(stat.trend.value)}%
                </div>
              )}
              <p className="text-xs text-slate-500">{stat.description}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
