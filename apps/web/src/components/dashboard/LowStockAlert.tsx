import { Badge } from "@dms/ui";
import { Panel } from "./Panel";

interface LowStockItem {
  id: string;
  quantityOnHand: number;
  reorderLevel: number;
  product: {
    name: string;
    productCode: string;
  };
}

interface LowStockAlertProps {
  /** Rows at or below zero — the out-of-stock slice of `/inventory/low-stock`. */
  items: LowStockItem[] | undefined;
  /** The endpoint's `total`, which counts every low-stock row on the page. */
  total?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

/**
 * Out-of-stock products only: `quantityOnHand <= 0`, including negatives, so a
 * product that still has units on hand never appears under this heading. The
 * count beside the title is this slice, not the endpoint total.
 */
export function LowStockAlert({
  items,
  total,
  loading = false,
  error = null,
  onRetry,
  className,
}: LowStockAlertProps) {
  const rows = items ?? [];
  const count = rows.length;

  return (
    <Panel
      title="Out of stock"
      description="Nothing left on hand"
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!loading && !error && rows.length === 0}
      emptyMessage="Nothing is out of stock"
      className={className}
      action={
        <Badge variant={count > 0 ? "destructive" : "secondary"}>
          {total !== undefined ? `${count} of ${total}` : count}
        </Badge>
      }
    >
      <ul className="divide-y">
        {rows.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {item.product.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.product.productCode}
              </p>
            </div>
            <p className="shrink-0 text-sm tabular-nums">
              <span className="font-semibold text-destructive">
                {item.quantityOnHand}
              </span>
              <span className="text-muted-foreground">
                {" / "}
                {item.reorderLevel}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
