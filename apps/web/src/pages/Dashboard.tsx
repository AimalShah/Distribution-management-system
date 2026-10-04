import useSWR from "swr";
import { Calendar } from "lucide-react";
import { Badge, Skeleton } from "@dms/ui";
import { PageHeader } from "../components/layout/PageHeader";
import { QueryError } from "../components/layout/QueryError";
import { StatsCards } from "../components/dashboard/StatsCards";
import { SalesChart } from "../components/dashboard/SalesChart";
import { InventoryChart } from "../components/dashboard/InventoryChart";
import { LowStockAlert } from "../components/dashboard/LowStockAlert";
import { TopProducts } from "../components/dashboard/TopProducts";
import { RecentActivities } from "../components/dashboard/RecentActivities";
import type { DashboardStats, SalesBasicReport } from "../types/dashboard";

/** The legacy window: the first of last month through today, as a UTC date. */
export function salesChartPath(now = new Date()): string {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `/reports/sales/basic?startDate=${start.toISOString().slice(0, 10)}`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" data-testid="dashboard-skeleton" aria-busy="true">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const stats = useSWR<DashboardStats>("/dashboard/stats");
  const sales = useSWR<SalesBasicReport>(salesChartPath());

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Dashboard"
        description="Here's what's happening with your business today."
        actions={
          <Badge variant="secondary" className="gap-1.5">
            <Calendar className="h-3 w-3" />
            {today}
          </Badge>
        }
      />

      {stats.error ? (
        <QueryError error={stats.error} onRetry={() => stats.mutate()} />
      ) : !stats.data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <StatsCards stats={stats.data} />
          <LowStockAlert count={stats.data.lowStockCount} />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {sales.error ? (
                <QueryError error={sales.error} onRetry={() => sales.mutate()} />
              ) : sales.data ? (
                <SalesChart data={sales.data.dailyTotals} />
              ) : (
                <Skeleton className="h-80" />
              )}
              <InventoryChart items={stats.data.inventoryLevels} />
            </div>
            <div className="space-y-6">
              <TopProducts products={stats.data.topProducts} />
              <RecentActivities activities={stats.data.recentActivities} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
