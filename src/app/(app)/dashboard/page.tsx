import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Calendar, BarChart3, Activity } from "lucide-react";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { InventoryChart } from "@/components/dashboard/InventoryChart";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { TopProducts } from "@/components/dashboard/TopProducts";
import { LowStockAlert } from "@/components/dashboard/LowStockAlert";

import DashboardStats from "@/components/dashboard/stats";
import { fetchSalesInvoices } from "@/actions/saleInvoice";
import { fetchProducts } from "@/actions/product";
import { fetchCustomers } from "@/actions/customer";
import { fetchPurchases } from "@/actions/purchase";
import { fetchInventory } from "@/actions/inventory";
import { SalesLineChartInteractive } from "@/components/reports/sales/SalesLineChart";
import { fetchFullSalesReport } from "@/actions/reports/salesReport";

type SalesData = {
  date: string;
  total: number;
};

type SaleInvoiceItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxPercent?: number | null;
  discount?: number | null;
  product: {
    id: string;
    name: string;
    productCode: string;
  };
};

type SaleInvoice = {
  id: string;
  saleCode: string;
  saleDate: Date;
  createdAt: Date;
  totalAmount: number;
  taxAmount: number | null;
  discount: number | null;
  status: string;
  customer: { name: string; id: string } | null;
  items: SaleInvoiceItem[];
};

type Product = {
  id: string;
  name: string;
  productCode: string;
  category: { name: string } | null;
  brand: { name: string } | null;
  inventory: { quantityOnHand: number } | null;
};

type Customer = {
  id: string;
  name: string;
  customerCode: string;
  sale: { id: string }[];
};

type InventoryItem = {
  id: string;
  productId: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderLevel: number;
  maxStockLevel: number | null;
  product: {
    id: string;
    name: string;
    productCode: string;
  };
  logs: { id: string; movementType: string; quantity: number; createdAt: Date }[];
};

type Purchase = {
  id: string;
  purchaseCode: string;
  purchaseDate: Date;
  createdAt: Date;
  totalAmount: number;
  taxAmount: number | null;
  discount: number | null;
  status: string;
  supplier: { companyName: string; id: string } | null;
  purchaseItems: {
    id: string;
    productId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    product: { name: string; id: string };
  }[];
};

export default async function DashboardPage() {
  const [
    saleInvoiceData,
    productsData,
    customersData,
    inventoryData,
    purchasesData,
  ] = await Promise.all([
    fetchSalesInvoices(),
    fetchProducts(),
    fetchCustomers(),
    fetchInventory(),
    fetchPurchases(),
  ]);
  const saleInvoice: SaleInvoice[] = saleInvoiceData?.data ?? [];
  const products: Product[] = productsData?.data ?? [];
  const customers: Customer[] = customersData?.data ?? [];
  const inventory: InventoryItem[] = inventoryData?.data ?? [];
  const purchases: Purchase[] = purchasesData?.data ?? [];

  const recentSales = saleInvoice.slice(0, 5);

  const recentPurchases = purchases.slice(0, 5);

  const lowStockItems = inventory.filter(
    (item) => item.quantityOnHand <= (item.reorderLevel || 10)
  ).length;

  const productSales = saleInvoice.reduce((acc, sale) => {
    sale.items.forEach((item) => {
      const productId = item.productId;
      if (!acc[productId]) {
        acc[productId] = {
          product: item.product,
          totalSold: 0,
          totalRevenue: 0,
        };
      }
      acc[productId].totalSold += item.quantity;
      acc[productId].totalRevenue += item.totalPrice;
    });
    return acc;
  }, {} as Record<string, { product: SaleInvoiceItem["product"]; totalSold: number; totalRevenue: number }>);

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  const today = new Date();
  const defaultEndDate = today;

  const defaultStartDate = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1
  );

  const salesReport = await fetchFullSalesReport({
    startDate: defaultStartDate.toISOString(),
    endDate: defaultEndDate.toISOString(),
  });

  const dailyTotals: SalesData[] = (
    salesReport?.basic?.dailyTotals ?? []
  ).map((day) => ({ date: day.date, total: Number(day.total) }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Dashboard
              </h1>
              <p className="text-slate-600 mt-1">
                Welcome back! Here&apos;s what&apos;s happening with your
                business today.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Calendar className="h-3 w-3" />
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <DashboardStats
            purchases={purchases}
            saleInvoice={saleInvoice}
            products={products}
            customers={customers}
            inventory={inventory}
          />
        </div>

        {lowStockItems > 0 && (
          <div className="mb-8">
            <LowStockAlert count={lowStockItems} />
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            {dailyTotals.length ? (
              <SalesLineChartInteractive data={dailyTotals} />
            ) : (
              <div className="flex items-center justify-center h-[420px] text-gray-500 text-sm">
                No sales data available
              </div>
            )}

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <div className="p-1.5 bg-green-100 rounded-md">
                    <Activity className="h-4 w-4 text-green-600" />
                  </div>
                  Inventory Status
                </CardTitle>
                <CardDescription>
                  Current inventory levels and stock status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InventoryChart data={inventory || []} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <div className="p-1.5 bg-orange-100 rounded-md">
                    <Package className="h-4 w-4 text-orange-600" />
                  </div>
                  Top Products
                </CardTitle>
                <CardDescription>
                  Best performing products this month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TopProducts products={topProducts} />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <div className="p-1.5 bg-purple-100 rounded-md">
                    <Activity className="h-4 w-4 text-purple-600" />
                  </div>
                  Recent Activities
                </CardTitle>
                <CardDescription>
                  Latest sales, purchases, and inventory updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RecentActivities
                  sales={recentSales}
                  purchases={recentPurchases}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
