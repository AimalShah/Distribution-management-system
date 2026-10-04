import { DollarSign, Package, ShoppingCart } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dms/ui";
import type { DashboardStats } from "../../types/dashboard";
import { formatCurrency, formatDate } from "../../lib/format";

export function RecentActivities({ activities }: { activities: DashboardStats["recentActivities"] }) {
  return (
    <Card data-testid="recent-activities">
      <CardHeader>
        <CardTitle>Recent Activities</CardTitle>
        <CardDescription>Latest sales and purchases</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8" />
            No recent activities
          </div>
        ) : (
          <ul className="space-y-3">
            {activities.map((activity) => {
              const isSale = activity.type === "sale";
              const Icon = isSale ? DollarSign : ShoppingCart;
              return (
                <li key={`${activity.type}-${activity.id}`} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className={`rounded-lg p-2 ${isSale ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{activity.counterparty}</span>
                        <Badge variant="outline">{isSale ? "Sale" : "Purchase"}</Badge>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency(activity.amount)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(activity.date)}</span>
                      <span className="font-mono">{activity.code}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
