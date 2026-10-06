import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  DollarSign,
  ShoppingCart,
  TriangleAlert,
  Truck,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@dms/ui";
import type { DashboardStats } from "../../lib/dashboard";
import { formatTotal } from "../../lib/format";

type Tile = {
  label: string;
  hint: string;
  icon: LucideIcon;
};

/**
 * The reference's stat tile: label and a muted glyph on one row, the number in
 * `text-2xl font-bold`, and one line of context beneath. The glyph is muted on
 * purpose — the earlier version tinted an icon chip per tile, which put six
 * saturated colors on a palette whose chart series is the only thing meant to
 * carry hue.
 */
const tiles: Tile[] = [
  {
    label: "Total sales",
    hint: "Revenue recorded",
    icon: DollarSign,
  },
  {
    label: "Total purchases",
    hint: "Spend recorded",
    icon: ShoppingCart,
  },
  {
    label: "Customers",
    hint: "Accounts on file",
    icon: Users,
  },
  {
    label: "Products",
    hint: "In the catalog",
    icon: Boxes,
  },
  {
    label: "Suppliers",
    hint: "Vendors on file",
    icon: Truck,
  },
  {
    label: "Low stock",
    hint: "At or below reorder level",
    icon: TriangleAlert,
  },
];

function valueFor(tile: Tile, stats?: DashboardStats): string {
  if (!stats) return "—";

  switch (tile.label) {
    case "Total sales":
      return formatTotal(stats.totalSalesAmount);
    case "Total purchases":
      return formatTotal(stats.totalPurchasesAmount);
    case "Customers":
      return stats.totalCustomers.toLocaleString();
    case "Products":
      return stats.totalProducts.toLocaleString();
    case "Suppliers":
      return stats.totalSuppliers.toLocaleString();
    default:
      return stats.lowStockCount.toLocaleString();
  }
}

export function Stats({
  stats,
  loading = false,
}: {
  stats: DashboardStats | undefined;
  loading?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {tile.label}
            </CardTitle>
            <tile.icon
              className="size-4 text-muted-foreground"
              aria-hidden
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">
                  {valueFor(tile, stats)}
                </p>
                <p className="text-xs text-muted-foreground">{tile.hint}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
