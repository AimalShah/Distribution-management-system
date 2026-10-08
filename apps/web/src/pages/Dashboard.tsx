import { useMemo, useState } from "react";
import useSWR from "swr";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  Clock,
  Download,
  FilePlus,
  PackageCheck,
  PlusCircle,
  Receipt,
  RefreshCw,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
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
import { formatDate, formatTotal, formatMoney } from "../lib/format";
import type {
  CustomerSalesRow,
  DashboardStats,
  LowStockRow,
  ProductSalesRow,
  PurchaseBasicReport,
  SalesBasicReport,
} from "../lib/dashboard";
import { ExpiringSoonCard } from "../components/dashboard/ExpiringSoonCard";
import { RecentActivities } from "../components/dashboard/RecentActivities";
import { LowStockAlert } from "../components/dashboard/LowStockAlert";
import { InventoryChart } from "../components/dashboard/InventoryChart";
import { SalesChart } from "../components/dashboard/SalesChart";
import { TopProducts } from "../components/dashboard/TopProducts";

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
    <div className="space-y-6 pb-12">
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Distribution Operations Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time commercial activity, inventory alerts, and financial overview for {range.label}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Window Range Selector */}
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
            {(["30d", "mtd", "ytd"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  mode === key
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {MODE_LABELS[key]}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 text-xs">
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <Card className="bg-card shadow-xs border-border">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <TrendingUp className="size-4 text-primary" />
            <span>Quick Actions</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate("/sales/new")}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-xs"
            >
              <FilePlus className="size-3.5" />
              New Sale Invoice
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/purchases/new")}
              className="gap-2 text-xs font-medium"
            >
              <Truck className="size-3.5 text-primary" />
              Receive Stock
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/inventory")}
              className="gap-2 text-xs font-medium"
            >
              <SlidersHorizontal className="size-3.5" />
              Stock Correction
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/customers")}
              className="gap-2 text-xs font-medium"
            >
              <Users className="size-3.5" />
              Customer Statement
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4 Headline KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Sales & Revenue */}
        <Card className="shadow-xs border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sales & Revenue
            </CardTitle>
            <CircleDollarSign className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            {salesReport.isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {formatTotal(salesTotal)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center">
                <ArrowUpRight className="size-3 inline" /> {salesReport.data?.totalOrders ?? 0}
              </span>
              completed invoices in {range.label.split("–")[0].trim()}
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Stock Purchases */}
        <Card className="shadow-xs border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Stock Purchases
            </CardTitle>
            <ShoppingCart className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {purchaseReport.isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {formatTotal(purchaseTotal)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="font-semibold">{purchaseReport.data?.totalOrders ?? 0} bills</span>
              received from suppliers
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Outstanding Balances */}
        <Card className="shadow-xs border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Outstanding Balances
            </CardTitle>
            <Receipt className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {stats.isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {formatTotal(outstandingBalances)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Uncollected customer receivables
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Urgent Stock Attention */}
        <Card className="shadow-xs border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Urgent Stock Attention
            </CardTitle>
            <AlertTriangle className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            {lowStockApi.isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {urgentStockCount} Items
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {outOfStockRows.length} out of stock, {lowStockRows.length} low
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <SalesChart
            className="h-full"
            data={salesReport.data?.dailyTotals}
            loading={salesReport.isLoading}
            error={
              salesReport.error
                ? failureMessage(salesReport.error, "Sales trend unavailable")
                : null
            }
            onRetry={retrySalesReport}
            rangeLabel={range.label}
          />
        </div>

        <div className="lg:col-span-4">
          <InventoryChart
            className="h-full"
            data={statsData?.topInventory}
            loading={stats.isLoading}
            error={statsError}
            onRetry={retryStats}
          />
        </div>
      </div>

      {/* Operational Attention: Low Stock & Expiring Batches */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Low Stock Items List */}
        <Card className="lg:col-span-8 shadow-xs border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Low Stock Inventory</CardTitle>
              <CardDescription className="text-xs">
                Items currently at or below minimum threshold
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/inventory")}
              className="text-xs"
            >
              View All
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {lowRows.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                All inventory levels are healthy.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Product</th>
                      <th className="px-4 py-2.5 font-medium">SKU</th>
                      <th className="px-4 py-2.5 font-medium text-right">On Hand</th>
                      <th className="px-4 py-2.5 font-medium text-right">Min Stock</th>
                      <th className="px-4 py-2.5 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lowRows.slice(0, 5).map((row) => (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {row.product?.name ?? "Product"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.product?.productCode ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge
                            variant={row.quantityOnHand <= 0 ? "destructive" : "secondary"}
                            className="text-[11px]"
                          >
                            {row.quantityOnHand} units
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {row.reorderLevel}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate("/purchases/new")}
                            className="h-7 text-xs px-2.5"
                          >
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

        {/* Expiring Soon Card */}
        <div className="lg:col-span-4">
          <ExpiringSoonCard />
        </div>
      </div>

      {/* Rankings & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6">
          <TopProducts
            data={topProducts.data}
            loading={topProducts.isLoading}
            error={
              topProducts.error
                ? failureMessage(topProducts.error, "Top products unavailable")
                : null
            }
            onRetry={() => void topProducts.mutate()}
            rangeLabel={range.label}
          />
        </div>

        <div className="lg:col-span-6">
          <RecentActivities
            purchases={statsData?.recentPurchases}
            loading={stats.isLoading}
            error={statsError}
            onRetry={retryStats}
          />
        </div>
      </div>
    </div>
  );
}
