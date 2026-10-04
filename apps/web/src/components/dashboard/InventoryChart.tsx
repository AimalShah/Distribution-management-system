import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@dms/ui";
import type { DashboardStats } from "../../types/dashboard";

const chartConfig = {
  quantityOnHand: { label: "Current Stock", color: "#10b981" },
  reorderLevel: { label: "Reorder Level", color: "#f59e0b" },
} satisfies ChartConfig;

export function InventoryChart({ items }: { items: DashboardStats["inventoryLevels"] }) {
  return (
    <Card data-testid="inventory-chart">
      <CardHeader>
        <CardTitle>Inventory Status</CardTitle>
        <CardDescription>The ten best-stocked products against their reorder levels</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            No inventory data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
            <BarChart data={items} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} interval={0} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="quantityOnHand" fill="var(--color-quantityOnHand)" radius={4} />
              <Bar dataKey="reorderLevel" fill="var(--color-reorderLevel)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
