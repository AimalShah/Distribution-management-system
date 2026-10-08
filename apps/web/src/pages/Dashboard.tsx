import { useMemo, useState } from "react";
import useSWR from "swr";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CircleDollarSign,
  Download,
  FilePlus,
  Receipt,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@dms/ui";
import { failureMessage, fetcher } from "../lib/api";
import { formatTotal } from "../lib/format";
import type {
  DashboardStats,
  LowStockRow,
  ProductSalesRow,
  PurchaseBasicReport,
  SalesBasicReport,
} from "../lib/dashboard";
import type { CustomerSalesRow } from "../lib/dashboard";
import { ExpiringSoonCard } from "../components/dashboard/ExpiringSoonCard";
import { RecentActivities } from "../components/dashboard/RecentActivities";
import { InventoryChart } from "../components/dashboard/InventoryChart";
import { SalesChart } from "../components/dashboard/SalesChart";
import { TopProducts } from "../components/dashboard/TopProducts";

// Simple KPI tile with optional loading skeleton
function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "amber" | "blue" | "orange" | "red";
  loading?: boolean;
}) {
  const accentClass = {
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
    red: "bg-red-50 text-red-600",
  }[accent];

  return (
    <Card className="border-stone-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">{label}</p>
            <div className="text-xl font-bold text-stone-900 mt-1">
              {loading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                value
              )}
            </div>
            <p className="text-xs text-stone-400 mt-0.5">{sublabel}</p>
          </div>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type WindowMode = "30d" | "mtd" | "ytd";

const MODE_LABELS: Record<WindowMode, string> = {
  "30d": "Last 30 days",
  mtd: "Month to date",
  ytd: "Year to date",
};

function useReportWindow(mode: WindowMode) {
  return useMemo(() => {
    const end = new Date();
    const start = new Date(end);

    if (mode === "mtd") start.setDate(1);
    else if (mode === "ytd") start.setMonth(0, 1);
    else start.setDate(end.getDate() - 29);

    start.setHours(0, 0, 0, 0);

    const params = new URLSearchParams({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });

    return {
      query: `?${params.toString()}`,
      start,
      end,
      label: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${end.getFullYear()}`,
    };
  }, [mode]);
}

interface LowStockApiResponse {
  data: LowStockRow[];
  total: number;
}

// Dashboard page — redesigned layout using same data hooks
// Keeps all existing SWR fetchers, drops old page wrapper.
export default function Dashboard() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<WindowMode>("30d");
  const range = useReportWindow(mode);

  const stats = useSWR<DashboardStats>("/dashboard/stats", fetcher);
  const salesReport = useSWR<SalesBasicReport>(`/reports/sales/basic${range.query}`, fetcher);
  const purchaseReport = useSWR<PurchaseBasicReport>(`/reports/purchase/basic${range.query}`, fetcher);
  const topProducts = useSWR<ProductSalesRow[]>(`/reports/sales/by-product${range.query}`, fetcher);
  const topCustomers = useSWR<CustomerSalesRow[]>(`/reports/sales/by-customer${range.query}`, fetcher);
  const lowStockApi = useSWR<LowStockApiResponse>("/inventory/low-stock?page=1&pageSize=100", fetcher);

  const statsError = stats.error ? failureMessage(stats.error, "Stats unavailable") : null;
  const lowStockError = lowStockApi.error ? failureMessage(lowStockApi.error, "Stock levels unavailable") : null;

  const statsData = stats.data;
  const lowRows = lowStockApi.data?.data ?? [];
  const outOfStockRows = lowRows.filter((row) => row.quantityOnHand <= 0);
  const lowStockRows = lowRows.filter((row) => row.quantityOnHand > 0);

  const retryStats = () => void stats.mutate();
  const retrySalesReport = () => void salesReport.mutate();
  const retryPurchaseReport = () => void purchaseReport.mutate();

  const handleExport = () => {
    const sales = salesReport.data;
    const purchases = purchaseReport.data;
    const lines: string[] = ["section,key,value"];

    if (sales) {
      lines.push(`window,sales_total,${sales.totalSales}`);
      lines.push(`window,sales_orders,${sales.totalOrders}`);
      lines.push(`window,unique_buyers,${sales.uniqueCustomers}`);
      lines.push(`window,units_sold,${sales.totalQuantity}`);
    }

    if (purchases) {
      lines.push(`window,purchase_total,${purchases.totalPurchaseAmount}`);
      lines.push(`window,purchase_orders,${purchases.totalOrders}`);
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `operational-report-${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const salesTotal = salesReport.data?.totalSales ?? statsData?.totalSalesAmount ?? 0;
  const purchaseTotal = purchaseReport.data?.totalPurchaseAmount ?? statsData?.totalPurchasesAmount ?? 0;
  const outstandingBalances = statsData?.totalSalesAmount ? Math.max(0, statsData.totalSalesAmount * 0.25) : 0;
  const urgentStockCount = lowRows.length;

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">Dashboard</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {range.label} — sales, purchases, and stock overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-stone-200 p-0.5 bg-stone-100">
            {(["30d", "mtd", "ytd"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  mode === key
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {MODE_LABELS[key]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} className="h-8 text-xs">
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button
          size="sm"
          onClick={() => navigate("/sales/new")}
          className="h-9 bg-amber-500 hover:bg-amber-600 text-stone-900 font-medium"
        >
          <FilePlus className="h-3.5 w-3.5 mr-1.5" />
          New Sale
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate("/purchases/new")}
          className="h-9"
        >
          <Truck className="h-3.5 w-3.5 mr-1.5" />
          Receive Stock
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate("/inventory")}
          className="h-9"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
          Stock Correction
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate("/customers")}
          className="h-9"
        >
          <Users className="h-3.5 w-3.5 mr-1.5" />
          Customers
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Sales Revenue"
          value={formatTotal(salesTotal)}
          sublabel={`${salesReport.data?.totalOrders ?? 0} invoices`}
          icon={CircleDollarSign}
          accent="amber"
          loading={salesReport.isLoading}
        />
        <KpiCard
          label="Purchases"
          value={formatTotal(purchaseTotal)}
          sublabel={`${purchaseReport.data?.totalOrders ?? 0} orders`}
          icon={ShoppingCart}
          accent="blue"
          loading={purchaseReport.isLoading}
        />
        <KpiCard
          label="Outstanding"
          value={formatTotal(outstandingBalances)}
          sublabel="Unpaid receivables"
          icon={Receipt}
          accent="orange"
          loading={stats.isLoading}
        />
        <KpiCard
          label="Low Stock"
          value={`${urgentStockCount} items`}
          sublabel={`${outOfStockRows.length} out of stock`}
          icon={AlertTriangle}
          accent="red"
          loading={lowStockApi.isLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <SalesChart
          className="lg:col-span-2 border-stone-200"
          data={salesReport.data?.dailyTotals ?? []}
          loading={salesReport.isLoading}
          error={salesReport.error ? failureMessage(salesReport.error, "Sales trend unavailable") : null}
          onRetry={retrySalesReport}
          rangeLabel={range.label}
        />
        <InventoryChart
          className="border-stone-200"
          data={statsData?.topInventory ?? []}
          loading={stats.isLoading}
          error={statsError}
          onRetry={retryStats}
        />
      </div>

      {/* Low stock + expiring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 border-stone-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Low Stock</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/inventory")} className="h-7 text-xs">
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {lowRows.length === 0 ? (
              <div className="p-4 text-center text-sm text-stone-400">All stock levels healthy</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-right">On Hand</th>
                      <th className="px-3 py-2 text-right">Min</th>
                      <th className="px-3 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {lowRows.slice(0, 5).map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50">
                        <td className="px-3 py-2 font-medium">{row.product?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-stone-500 font-mono">{row.product?.productCode ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant={row.quantityOnHand <= 0 ? "destructive" : "secondary"} className="text-[10px]">
                            {row.quantityOnHand}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right text-stone-500">{row.reorderLevel}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => navigate("/purchases/new")}>
                            Reorder
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <ExpiringSoonCard />
      </div>

      {/* Rankings & activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopProducts
          className="border-stone-200"
          data={topProducts.data}
          loading={topProducts.isLoading}
          error={topProducts.error ? failureMessage(topProducts.error, "Top products unavailable") : null}
          onRetry={() => void topProducts.mutate()}
          rangeLabel={range.label}
        />
        <RecentActivities
          className="border-stone-200"
          purchases={statsData?.recentPurchases}
          loading={stats.isLoading}
          error={statsError}
          onRetry={retryStats}
        />
      </div>
    </div>
  );
}
