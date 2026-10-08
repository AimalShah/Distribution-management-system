import { ArrowDownLeft } from "lucide-react";
import { Badge, cn } from "@dms/ui";
import type { RecentPurchase } from "../../lib/dashboard";
import { formatDate, formatMoney } from "../../lib/format";
import { Panel } from "./Panel";

interface RecentActivitiesProps {
  purchases: RecentPurchase[] | undefined;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

/**
 * Inbound activity beside the invoice table: the newest purchase orders from
 * `/dashboard/stats`, same rows and ordering the endpoint returns. Sales keep
 * their own table on the left, so this feed stays single-sided instead of
 * re-merging two lists.
 */
export function RecentActivities({
  purchases,
  loading = false,
  error = null,
  onRetry,
  className,
}: RecentActivitiesProps) {
  const rows = (purchases ?? []).slice(0, 8);

  return (
    <Panel
      title="Recent purchases"
      description="Newest purchase orders"
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!loading && !error && rows.length === 0}
      emptyMessage="No purchase orders yet"
      skeletonHeight="h-64"
      className={className}
    >
      <ul className="divide-y">
        {rows.map((purchase) => (
          <li
            key={purchase.id}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                "bg-chart-3/10 text-chart-3"
              )}
            >
              <ArrowDownLeft className="size-4" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                <span className="font-medium">{purchase.purchaseCode}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {purchase.supplier.companyName}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Purchase · {formatDate(purchase.purchaseDate)}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-medium tabular-nums">
                {formatMoney(purchase.totalAmount)}
              </p>
              <Badge variant="outline" className="mt-1 font-normal">
                {purchase.status}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
