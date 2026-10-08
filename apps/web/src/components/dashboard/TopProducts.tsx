import { Panel } from "./Panel";
import { formatMoney } from "../../lib/format";

interface TopProduct {
  productId: string;
  name: string;
  productCode: string;
  quantity: number;
  totalPrice: number;
}

interface TopProductsProps {
  data: TopProduct[] | undefined;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  rangeLabel?: string;
  className?: string;
}

export function TopProducts({
  data,
  loading = false,
  error = null,
  onRetry,
  rangeLabel = "this window",
  className,
}: TopProductsProps) {
  // `by-product` is the report endpoint, so it hands back every product with a
  // sale in the window -- 159 of them against a seeded catalog. The panel is a
  // leaderboard, not a table, so cap it here rather than in the route: the
  // reports screen will want the whole list.
  const rows = (data ?? []).slice(0, 10);

  return (
    <Panel
      title="Top products"
      description={`Ranked by revenue, ${rangeLabel}`}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!loading && !error && rows.length === 0}
      emptyMessage="No product has sold in this window"
      skeletonHeight="h-64"
      className={className}
    >
      <ol className="divide-y">
        {rows.map((product, index) => (
          <li
            key={product.productId}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-muted-foreground">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{product.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {product.productCode}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-medium tabular-nums">
                {formatMoney(product.totalPrice)}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {product.quantity.toLocaleString()} sold
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
