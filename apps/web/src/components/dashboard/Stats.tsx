import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  CreditCard,
  PackageCheck,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@dms/ui";
import type { PurchaseBasicReport, SalesBasicReport } from "../../lib/dashboard";

type Tile = {
  label: string;
  hint: string;
  icon: LucideIcon;
};

/**
 * The volume row of the window — invoices, units, buyers, orders — read from
 * the same `startDate`/`endDate` reports as the money row above it, so the two
 * rows always describe the same slice of time.
 */
const tiles: Tile[] = [
  {
    label: "Invoices sold",
    hint: "Invoices in window",
    icon: Receipt,
  },
  {
    label: "Units sold",
    hint: "Across all invoice lines",
    icon: Boxes,
  },
  {
    label: "Unique buyers",
    hint: "Customers who ordered",
    icon: Users,
  },
  {
    label: "Products sold",
    hint: "Distinct products ordered",
    icon: ShoppingCart,
  },
  {
    label: "Purchase orders",
    hint: "Orders in window",
    icon: PackageCheck,
  },
  {
    label: "Units received",
    hint: "Across all purchase lines",
    icon: CreditCard,
  },
];

function valueFor(
  tile: Tile,
  salesReport: SalesBasicReport | undefined,
  purchaseReport: PurchaseBasicReport | undefined,
  productsSold: number | undefined,
): string {
  switch (tile.label) {
    case "Invoices sold":
      return salesReport ? salesReport.totalOrders.toLocaleString() : "—";
    case "Units sold":
      return salesReport ? salesReport.totalQuantity.toLocaleString() : "—";
    case "Unique buyers":
      return salesReport ? salesReport.uniqueCustomers.toLocaleString() : "—";
    case "Products sold":
      return productsSold !== undefined ? productsSold.toLocaleString() : "—";
    case "Purchase orders":
      return purchaseReport ? purchaseReport.totalOrders.toLocaleString() : "—";
    default:
      return purchaseReport ? purchaseReport.totalQuantity.toLocaleString() : "—";
  }
}

export function Stats({
  loading = false,
  error = null,
  onRetry,
  salesReport,
  purchaseReport,
  productsSold,
}: {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  salesReport: SalesBasicReport | undefined;
  purchaseReport: PurchaseBasicReport | undefined;
  productsSold: number | undefined;
}) {
  return (
    <div>
      <div className="rounded-md border border-border bg-card p-0 divide-y sm:divide-y-0 sm:divide-x divide-border grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 overflow-hidden">
        {tiles.map((tile) => (
          <div key={tile.label} className="p-3 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                {tile.label}
              </span>
              <tile.icon
                className="size-3.5 text-muted-foreground/60 shrink-0 ml-1"
                aria-hidden
              />
            </div>
            <div>
              {loading ? (
                <div className="space-y-1.5 py-1">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ) : (
                <>
                  <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                    {valueFor(tile, salesReport, purchaseReport, productsSold)}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{tile.hint}</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
        >
          <TriangleAlert className="size-4 text-destructive" />
          <span className="text-sm flex-1 min-w-48">{error}</span>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
