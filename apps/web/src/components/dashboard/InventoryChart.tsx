import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StockRow } from "../../lib/dashboard";
import { Panel } from "./Panel";

interface InventoryChartProps {
  data: StockRow[] | undefined;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
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

const legend = [
  { label: "On hand", color: "var(--chart-2)" },
  { label: "Reorder level", color: "var(--chart-4)" },
] as const;

/**
 * Ten bars, not a table: the question this answers is "which products are
 * carrying the stock", and a sorted table would be the better component for
 * finding one product. The service already hands the rows ordered by
 * `quantityOnHand` desc, so the slice is the chart's own limit rather than a
 * second sort.
 */
export function InventoryChart({
  data,
  loading = false,
  error = null,
  onRetry,
  className,
}: InventoryChartProps) {
  const rows = data ?? [];

  const points = rows.map((row) => ({
    name: row.product.name,
    quantity: row.quantityOnHand,
    reorderLevel: row.reorderLevel,
  }));

  return (
    <Panel
      title="Stock levels"
      description="Ten products holding the most stock"
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={points.length === 0}
      emptyMessage="No inventory yet"
      skeletonHeight="h-72"
      className={className}
    >
      {/* `flex-1` is what keeps this card from showing a hundred empty pixels
          under the chart when the row it sits in is sized by a taller
          neighbour. `min-h` is the floor when it is the taller one. */}
      <div className="flex min-h-64 flex-1 flex-col gap-4">
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              margin={{ top: 8, right: 8, left: 24, bottom: 0 }}
              barGap={2}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              {/* `left` buys room for the angled product names: a rotated tick
                  label is `name width * cos(angle)` wider than its tick, and
                  the SVG clips anything past x=0, which was shaving the first
                  name down to its last word. */}
              <XAxis
                dataKey="name"
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                angle={-35}
                textAnchor="end"
                height={72}
                interval={0}
                tickMargin={6}
              />
              <YAxis
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={tooltipStyle}
                formatter={(value, name) => [
                  Number(value).toLocaleString(),
                  name === "quantity" ? "On hand" : "Reorder level",
                ]}
              />
              <Bar
                dataKey="quantity"
                name="On hand"
                fill="var(--chart-2)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="reorderLevel"
                name="Reorder level"
                fill="var(--chart-4)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          {legend.map((entry) => (
            <span key={entry.label} className="inline-flex items-center gap-2">
              <span
                className="size-2.5 rounded-sm"
                style={{ background: entry.color }}
                aria-hidden
              />
              {entry.label}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
}
