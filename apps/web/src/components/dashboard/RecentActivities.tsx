import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Badge, cn } from "@dms/ui";
import type { RecentPurchase, RecentSale } from "../../lib/dashboard";
import { formatDate, formatMoney } from "../../lib/format";
import { Panel } from "./Panel";

interface RecentActivitiesProps {
  sales: RecentSale[] | undefined;
  purchases: RecentPurchase[] | undefined;
  loading?: boolean;
}

type Activity = {
  key: string;
  kind: "Sale" | "Purchase";
  ref: string;
  party: string;
  amount: number;
  status: string;
  date: string;
};

/**
 * Two queries, one feed. The rows are merged and re-sorted here rather than
 * interleaved by the caller because "what happened most recently" is the only
 * order the card ever promises, and the server can only sort within one list.
 */
export function RecentActivities({
  sales,
  purchases,
  loading = false,
}: RecentActivitiesProps) {
  const activities: Activity[] = [
    ...(sales ?? []).map((sale) => ({
      key: `sale-${sale.id}`,
      kind: "Sale" as const,
      ref: sale.saleCode,
      party: sale.customer.name,
      amount: sale.totalAmount,
      status: sale.status,
      date: sale.saleDate,
    })),
    ...(purchases ?? []).map((purchase) => ({
      key: `purchase-${purchase.id}`,
      kind: "Purchase" as const,
      ref: purchase.purchaseCode,
      party: purchase.supplier.companyName,
      amount: purchase.totalAmount,
      status: purchase.status,
      date: purchase.purchaseDate,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <Panel
      title="Recent activities"
      description="Latest sales and purchases"
      loading={loading}
      empty={!loading && activities.length === 0}
      emptyMessage="Nothing has been recorded yet"
      skeletonHeight="h-64"
    >
      <ul className="divide-y">
        {activities.map((activity) => {
          const isSale = activity.kind === "Sale";

          return (
            <li
              key={activity.key}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  isSale
                    ? "bg-chart-2/10 text-chart-2"
                    : "bg-chart-3/10 text-chart-3"
                )}
              >
                {isSale ? (
                  <ArrowUpRight className="size-4" aria-hidden />
                ) : (
                  <ArrowDownLeft className="size-4" aria-hidden />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="font-medium">{activity.ref}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {activity.party}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {activity.kind} · {formatDate(activity.date)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums">
                  {formatMoney(activity.amount)}
                </p>
                <Badge variant="outline" className="mt-1 font-normal">
                  {activity.status}
                </Badge>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
