import { ArrowDownRight, ArrowUpRight, DollarSign, Package, ShoppingCart, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@dms/ui";
import type { DashboardStats } from "../../types/dashboard";
import { formatCurrency, formatNumber } from "../../lib/format";

function Trend({ value }: { value: number | null }) {
  if (value === null) {
    return <p className="text-xs text-muted-foreground">No sales last month to compare</p>;
  }
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className={`flex items-center text-xs ${up ? "text-green-600" : "text-red-600"}`}>
      <Icon className="mr-1 h-3 w-3" />
      {up ? "+" : ""}
      {value}% from last month
    </p>
  );
}

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const cards = [
    {
      title: "Total Sales",
      value: formatCurrency(stats.totals.sales),
      footer: <Trend value={stats.trends.sales} />,
      icon: DollarSign,
      tone: "bg-green-50 text-green-600",
    },
    {
      title: "Total Purchases",
      value: formatCurrency(stats.totals.purchases),
      footer: <Trend value={stats.trends.purchases} />,
      icon: ShoppingCart,
      tone: "bg-blue-50 text-blue-600",
    },
    {
      title: "Total Customers",
      value: formatNumber(stats.totals.customers),
      footer: <p className="text-xs text-muted-foreground">Customers on file</p>,
      icon: Users,
      tone: "bg-purple-50 text-purple-600",
    },
    {
      title: "Total Products",
      value: formatNumber(stats.totals.products),
      footer: <p className="text-xs text-muted-foreground">Products in the catalogue</p>,
      icon: Package,
      tone: "bg-orange-50 text-orange-600",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} data-testid="stat-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <div className={`rounded-lg p-2 ${card.tone}`}>
              <card.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <div className="mt-1">{card.footer}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
