import { useMemo, useState } from "react";
import useSWR from "swr";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CircleDollarSign,
  Download,
  FilePlus,
  Package,
  Receipt,
  ShoppingCart,
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
import { StockShortagesCard } from "../components/dashboard/StockShortagesCard";
import { ExpiringSoonCard } from "../components/dashboard/ExpiringSoonCard";
import { OverdueReceivablesCard } from "../components/dashboard/OverdueReceivablesCard";
import { RecentActivities } from "../components/dashboard/RecentActivities";
import { InventoryChart } from "../components/dashboard/InventoryChart";
import { SalesChart } from "../components/dashboard/SalesChart";
import { TopProducts } from "../components/dashboard/TopProducts";

// High-contrast, refined KPI tile with neutral cards and subtle status badges
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
  accent: "emerald" | "blue" | "amber" | "rose";
  loading?: boolean;
}) {
  const accentStyles = {
    emerald: {
      icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      indicator: "bg-emerald-500",
    },
    blue: {
      icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
      indicator: "bg-sky-500",
    },
    amber: {
      icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      indicator: "bg-amber-500",
    },
    rose: {
      icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      indicator: "bg-rose-500",
    },
  }[accent];

  return (
    <Card className="border-border relative overflow-hidden bg-card transition-shadow hover:shadow-sm">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${accentStyles.indicator}`} />
      <CardContent className="p-4 pt-4.5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
            <div className="text-xl font-bold text-foreground mt-1 tracking-tight">
              {loading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                value
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentStyles.icon}`}>
            <Icon className="h-4.5 w-4.5" />
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<WindowMode>("30d");
  const range = useReportWindow(mode);

  const stats = useSWR<DashboardStats>("/dashboard/stats", fetcher);
  const salesReport = useSWR<SalesBasicReport>(`/reports/sales/basic${range.query}`, fetcher);
  const purchaseReport = useSWR<PurchaseBasicReport>(`/reports/purchase/basic${range.query}`, fetcher);
  const topProducts = useSWR<ProductSalesRow[]>(`/reports/sales/by-product${range.query}`, fetcher);
  const lowStockApi = useSWR<LowStockApiResponse>("/inventory/low-stock?page=1&pageSize=100", fetcher);

  const statsError = stats.error ? failureMessage(stats.error, "Stats unavailable") : null;
  const statsData = stats.data;
  const lowRows = lowStockApi.data?.data ?? [];
  const outOfStockRows = lowRows.filter((row) => row.quantityOnHand <= 0);

  const retryStats = () => void stats.mutate();
  const retrySalesReport = () => void salesReport.mutate();

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
  const outstandingBalances = statsData?.outstanding ?? 0;
  const urgentStockCount = lowRows.length;

  return (
    <div className="space-y-6">
      {/* Cockpit Header with Time Controls & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Operational Cockpit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {range.label} — Live sales, stock, and fulfillment status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5 bg-muted/60">
            {(["30d", "mtd", "ytd"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${mode === key
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {MODE_LABELS[key]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} className="h-8 text-xs">
            <Download className="h-3.5 w-3.5 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Operational Quick Action Bar */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg border border-border bg-card/60 backdrop-blur-xs">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mr-1 hidden sm:inline-block">
          Quick Actions:
        </span>
        <Button
          size="sm"
          onClick={() => navigate("/sales/new")}
          className="h-8.5 text-xs font-medium gap-1.5"
        >
          <FilePlus className="h-4 w-4" />
          <span>New Sale Invoice</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate("/purchases/new")}
          className="h-8.5 text-xs font-medium gap-1.5"
        >
          <Truck className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <span>New Purchase Order</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate("/inventory")}
          className="h-8.5 text-xs font-medium gap-1.5"
        >
          <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Stock Management</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate("/customers")}
          className="h-8.5 text-xs font-medium gap-1.5"
        >
          <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span>Customers & Statements</span>
        </Button>
      </div>

      {/* Primary High-Contrast KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Sales Revenue"
          value={formatTotal(salesTotal)}
          sublabel={`${salesReport.data?.totalOrders ?? 0} invoices in window`}
          icon={CircleDollarSign}
          accent="emerald"
          loading={salesReport.isLoading}
        />
        <KpiCard
          label="Purchases"
          value={formatTotal(purchaseTotal)}
          sublabel={`${purchaseReport.data?.totalOrders ?? 0} orders received`}
          icon={ShoppingCart}
          accent="blue"
          loading={purchaseReport.isLoading}
        />
        <KpiCard
          label="Receivables"
          value={formatTotal(outstandingBalances)}
          sublabel="Outstanding invoices"
          icon={Receipt}
          accent="amber"
          loading={stats.isLoading}
        />
        <KpiCard
          label="Shortages & Alerts"
          value={`${urgentStockCount} items`}
          sublabel={`${outOfStockRows.length} out of stock`}
          icon={AlertTriangle}
          accent="rose"
          loading={lowStockApi.isLoading}
        />
      </div>

      {/* Urgent Attention Alerts Row: Shortages, Expiring Batches, & Overdue Receivables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Low Stock & Shortages */}
        <StockShortagesCard />

        {/* Expiring Soon Batches */}
        <ExpiringSoonCard />

        {/* Overdue Receivables with Direct Ledger Links */}
        <OverdueReceivablesCard />
      </div>

      {/* Trend & Volume Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SalesChart
          className="lg:col-span-2 border-border"
          data={salesReport.data?.dailyTotals ?? []}
          loading={salesReport.isLoading}
          error={salesReport.error ? failureMessage(salesReport.error, "Sales trend unavailable") : null}
          onRetry={retrySalesReport}
          rangeLabel={range.label}
        />
        <InventoryChart
          className="border-border"
          data={statsData?.topInventory ?? []}
          loading={stats.isLoading}
          error={statsError}
          onRetry={retryStats}
        />
      </div>

      {/* Rankings & Activity Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopProducts
          className="border-border"
          data={topProducts.data}
          loading={topProducts.isLoading}
          error={topProducts.error ? failureMessage(topProducts.error, "Top products unavailable") : null}
          onRetry={() => void topProducts.mutate()}
          rangeLabel={range.label}
        />
        <RecentActivities
          className="border-border"
          purchases={statsData?.recentPurchases}
          loading={stats.isLoading}
          error={statsError}
          onRetry={retryStats}
        />
      </div>
    </div>
  );
}
