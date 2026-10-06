import { useMemo } from "react";
import useSWR from "swr";
import { DollarSign, FileText, ShoppingCart, Users } from "lucide-react";
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

interface SalesReportTabProps {
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

export function SalesReportTab({ queryString }: SalesReportTabProps) {
  const { data, isLoading } = useSWR(
    `/reports/sales/full?${queryString}`,
    fetcher
  );

  const basic = data?.basic;
  const customers = data?.byCustomer ?? [];
  const products = data?.byProduct ?? [];
  const dailyTotals = basic?.dailyTotals ?? [];

  const cards = useMemo(
    () => [
      {
        title: "Total Sales",
        value: basic?.totalSales !== undefined ? formatMoney(basic.totalSales) : "—",
        icon: DollarSign,
        tileClassName: "bg-primary/10 text-primary",
      },
      {
        title: "Total Orders",
        value: basic?.totalOrders ?? "—",
        icon: ShoppingCart,
        tileClassName: "bg-primary/10 text-primary",
      },
      {
        title: "Unique Customers",
        value: basic?.uniqueCustomers ?? "—",
        icon: Users,
        tileClassName: "bg-primary/10 text-primary",
      },
      {
        title: "Total Units Sold",
        value: basic?.totalQuantity ?? "—",
        icon: FileText,
        tileClassName: "bg-primary/10 text-primary",
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

      {/* Chart: Sales Over Time */}
      <ReportSectionCard
        title="Sales Over Time"
        description="Revenue trends by invoice date across the selected window."
      >
        {dailyTotals.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dailyTotals}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesReportArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
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
                  tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={54}
                />
                <Tooltip
                  cursor={{ stroke: "var(--border)" }}
                  contentStyle={tooltipStyle}
                  labelFormatter={(label) => formatDate(String(label))}
                  formatter={(val) => [formatMoney(Number(val)), "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#salesReportArea)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            No sales data available
          </div>
        )}
      </ReportSectionCard>

      {/* Breakdowns: Customer and Product */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* By Customer */}
        <ReportBreakdownList
          title="Sales by Customer"
          description="Top revenue contributing accounts for this period."
          emptyText="No customer data available"
          rows={customers.slice(0, 5).map((cust: any) => ({
            key: cust.customerId,
            label: cust.name,
            sub: `${cust.orders} ${cust.orders === 1 ? "order" : "orders"}`,
            right: formatMoney(cust.totalAmount),
          }))}
        />

        {/* By Product */}
        <ReportBreakdownList
          title="Sales by Product"
          description="Highest grossing products sold in this period."
          emptyText="No product data available"
          rows={products.slice(0, 5).map((prod: any) => ({
            key: prod.productId,
            label: prod.name,
            sub: `${prod.quantity} ${prod.unit || "units"} sold`,
            right: formatMoney(prod.totalPrice),
          }))}
        />
      </div>
    </div>
  );
}
