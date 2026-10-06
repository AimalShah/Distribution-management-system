import { useMemo } from "react";
import useSWR from "swr";
import { DollarSign, FileText, ShoppingCart, Truck } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../lib/api";
import { formatDate, formatDay, formatMoney } from "../../lib/format";
import {
  KpiCardGrid,
  ReportBreakdownList,
  ReportSectionCard,
  ReportTabsSkeleton,
} from "./ReportPrimitives";

const fetcher = (url: string) => api.get(url).then((r) => r.data);

interface PurchaseReportTabProps {
  queryString: string;
}

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 } as const;

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: 13,
} as const;

export function PurchaseReportTab({ queryString }: PurchaseReportTabProps) {
  const { data, isLoading } = useSWR(
    `/reports/purchase/full?${queryString}`,
    fetcher
  );

  const basic = data?.basic;
  const suppliers = data?.bySupplier ?? [];
  const products = data?.byProduct ?? [];
  const dailyTotals = basic?.dailyTotals ?? [];

  const cards = useMemo(
    () => [
      {
        title: "Total Purchase Amount",
        value: basic?.totalPurchaseAmount !== undefined ? formatMoney(basic.totalPurchaseAmount) : "—",
        icon: DollarSign,
        tileClassName: "bg-muted text-muted-foreground",
      },
      {
        title: "Total Orders",
        value: basic?.totalOrders ?? "—",
        icon: ShoppingCart,
        tileClassName: "bg-muted text-muted-foreground",
      },
      {
        title: "Unique Suppliers",
        value: basic?.uniqueSuppliers ?? "—",
        icon: Truck,
        tileClassName: "bg-muted text-muted-foreground",
      },
      {
        title: "Total Items Purchased",
        value: basic?.totalQuantity ?? "—",
        icon: FileText,
        tileClassName: "bg-muted text-muted-foreground",
      },
    ],
    [basic]
  );

  if (isLoading) {
    return <ReportTabsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <KpiCardGrid cards={cards} />

      {/* Chart: Purchases Over Time */}
      <ReportSectionCard
        title="Purchases Over Time"
        description="Spend patterns by purchase order date across the selected window."
      >
        {dailyTotals.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dailyTotals}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="purchaseReportArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2, #3b82f6)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-2, #3b82f6)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDay}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tickFormatter={(v) => (v >= 1000 ? `Rs ${(v / 1000).toFixed(0)}k` : `Rs ${v}`)}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={54}
                />
                <Tooltip
                  cursor={{ stroke: "var(--border)" }}
                  contentStyle={tooltipStyle}
                  labelFormatter={(label) => formatDate(String(label))}
                  formatter={(val) => [formatMoney(Number(val)), "Spend"]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--chart-2, #3b82f6)"
                  strokeWidth={2}
                  fill="url(#purchaseReportArea)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            No purchase data available
          </div>
        )}
      </ReportSectionCard>

      {/* Breakdowns: Supplier and Product */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* By Supplier */}
        <ReportBreakdownList
          title="Spend by Supplier"
          description="Suppliers with highest procurement spend in this window."
          emptyText="No supplier data available"
          rows={suppliers.slice(0, 5).map((supp: any) => ({
            key: supp.supplierId,
            label: supp.companyName,
            sub: `${supp.orders} ${supp.orders === 1 ? "order" : "orders"}`,
            right: formatMoney(supp.totalAmount),
          }))}
        />

        {/* By Product */}
        <ReportBreakdownList
          title="Purchases by Product"
          description="Most purchased stock lines in this window."
          emptyText="No product data available"
          rows={products.slice(0, 5).map((prod: any) => ({
            key: prod.productId,
            label: prod.name,
            sub: `${prod.quantity} ${prod.unit || "units"} purchased`,
            right: formatMoney(prod.totalCost),
          }))}
        />
      </div>
    </div>
  );
}
