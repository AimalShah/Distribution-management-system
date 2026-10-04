import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@dms/ui";
import { formatCurrency } from "../../lib/format";

const chartConfig = {
  total: { label: "Sales", color: "#3b82f6" },
} satisfies ChartConfig;

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function SalesChart({ data }: { data: { date: string; total: number }[] }) {
  const total = data.reduce((sum, day) => sum + day.total, 0);

  return (
    <Card data-testid="sales-chart">
      <CardHeader className="flex flex-row items-start justify-between border-b">
        <div>
          <CardTitle>Sales Over Time</CardTitle>
          <CardDescription>Since the start of last month</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Sales</div>
          <div className="text-2xl font-bold" data-testid="sales-chart-total">
            {formatCurrency(total)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            No sales data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <LineChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={shortDate}
              />
              <ChartTooltip content={<ChartTooltipContent nameKey="total" labelFormatter={shortDate} />} />
              <Line dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
