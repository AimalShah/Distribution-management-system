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
  items: LowStockItem[] | undefined;
  /** The endpoint's `total`, which counts every row and not just this page. */
  total?: number;
  loading?: boolean;
  className?: string;
}

export function LowStockAlert({
  items,
  total,
  loading = false,
  className,
}: LowStockAlertProps) {
  const rows = items ?? [];
  const count = total ?? rows.length;

  return (
    <Panel
      title="Low stock"
      description="At or below their reorder level"
      loading={loading}
      empty={!loading && rows.length === 0}
      emptyMessage="Every product is above its reorder level"
      className={className}
      action={
        <Badge variant={count > 0 ? "destructive" : "secondary"}>{count}</Badge>
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
