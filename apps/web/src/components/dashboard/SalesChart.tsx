import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDay, formatDate, formatMoney } from "../../lib/format";
import { Panel } from "./Panel";

interface SalesChartProps {
  data: { date: string; total: number }[] | undefined;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  rangeLabel?: string;
  className?: string;
}

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 } as const;

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: 13,
} as const;

const formatAxisMoney = (value: number) =>
  Math.abs(value) >= 1000
    ? `Rs ${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
    : `Rs ${value}`;

/**
 * Purchase spend per day for the selected window — the inbound mirror of the
 * sales trend beside it. The sales side has its own panel, so this one reads
 * from `/reports/purchase/basic` rather than repeating revenue.
 */
export function SalesChart({
  data,
  loading = false,
  error = null,
  onRetry,
  rangeLabel = "selected window",
  className,
}: SalesChartProps) {
  const points = data ?? [];

  return (
    <Panel
      title="Purchases"
      description={`Spend per day, ${rangeLabel}`}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={points.length === 0}
      emptyMessage="No purchase orders in this window"
      skeletonHeight="h-72"
      className={className}
    >
      {/* Grows with the card when the list beside it is taller, so a short
          chart never leaves a blank band under itself. */}
      <div className="min-h-72 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="purchaseAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-3)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-3)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatAxisMoney}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={54}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              contentStyle={tooltipStyle}
              labelFormatter={(label) => formatDate(String(label))}
              formatter={(value) => [formatMoney(Number(value)), "Spend"]}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--chart-3)"
              strokeWidth={2}
              fill="url(#purchaseAreaFill)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
