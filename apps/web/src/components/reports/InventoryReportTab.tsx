import { useMemo } from "react";
import useSWR from "swr";
import { AlertTriangle, DollarSign, Layers, Package } from "lucide-react";
import { Badge } from "@dms/ui";
import { api } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";
import {
  KpiCardGrid,
  ReportBreakdownList,
  ReportSectionCard,
  ReportTabsSkeleton,
} from "./ReportPrimitives";

const fetcher = (url: string) => api.get(url).then((r) => r.data);

interface InventoryReportTabProps {
  queryString: string;
}

export function InventoryReportTab({ queryString }: InventoryReportTabProps) {
  const { data, isLoading } = useSWR(
    `/reports/inventory/full?${queryString}`,
    fetcher
  );

  const basic = data?.basic ?? [];
  const movements = data?.movements ?? [];
  const lowStock = data?.lowStock ?? [];
  const stockValuation = data?.stockValuation;
  const valuationItems = stockValuation?.items ?? [];

  const totalInventoryValue = stockValuation?.totalValue ?? 0;
  const totalItemsInStock = useMemo(
    () => basic.reduce((sum: number, item: any) => sum + (item.quantityOnHand || 0), 0),
    [basic]
  );
  const lowStockCount = lowStock.length;
  const uniqueProducts = basic.length;

  const cards = useMemo(
    () => [
      {
        title: "Total Inventory Value",
        value: formatMoney(totalInventoryValue),
        icon: DollarSign,
        tileClassName: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      },
      {
        title: "Total Items in Stock",
        value: totalItemsInStock,
        icon: Package,
        tileClassName: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      },
      {
        title: "Low Stock Items",
        value: lowStockCount,
        icon: AlertTriangle,
        tileClassName:
          lowStockCount > 0
            ? "bg-destructive/10 text-destructive"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      },
      {
        title: "Unique Products",
        value: uniqueProducts,
        icon: Layers,
        tileClassName: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      },
    ],
    [totalInventoryValue, totalItemsInStock, lowStockCount, uniqueProducts]
  );

  if (isLoading) {
    return <ReportTabsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <KpiCardGrid cards={cards} />

      {/* Tables: Stock Valuation and Recent Movements */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stock Valuation */}
        <ReportBreakdownList
          title="Stock Valuation"
          description="Current inventory balances valued at historical average unit cost."
          emptyText="No inventory valuation data available"
          rows={valuationItems.slice(0, 6).map((item: any) => ({
            key: item.id,
            label: item.name,
            sub: `${item.quantityOnHand} ${item.unit || "pcs"} on hand @ ${formatMoney(item.averageUnitCost)}`,
            right: formatMoney(item.totalValue),
          }))}
        />

        {/* Inventory Movements */}
        <ReportSectionCard
          title="Inventory Movements"
          description="Audit log of receipts, shipments, adjustments, and damaged stock."
        >
          {movements.length > 0 ? (
            <div className="divide-y divide-border">
              {movements.slice(0, 6).map((mov: any) => {
                const isIn = mov.movementType === "IN";
                const isOut = mov.movementType === "OUT" || mov.movementType === "DAMAGED";
                return (
                  <div
                    key={mov.id}
                    className="py-3 flex items-center justify-between text-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{mov.product.name}</p>
                        <Badge
                          variant="secondary"
                          className={
                            isIn
                              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                              : isOut
                                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                                : ""
                          }
                        >
                          {mov.movementType}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(mov.createdAt)} • prev: {mov.previousQty} → new: {mov.newQty}
                      </p>
                    </div>
                    <span
                      className={`font-semibold ${
                        isIn ? "text-green-700 dark:text-green-400" : ""
                      }`}
                    >
                      {isIn ? `+${mov.quantity}` : mov.quantity}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              No inventory movements in this period
            </div>
          )}
        </ReportSectionCard>
      </div>

      {/* Low Stock Watchlist */}
      {lowStock.length > 0 && (
        <ReportSectionCard
          titleClassName="text-base font-semibold text-destructive flex items-center gap-2"
          title={
            <>
              <AlertTriangle className="size-4" />
              Low Stock Warnings
            </>
          }
          description="Products at or below reorder threshold needing procurement."
        >
          <div className="divide-y divide-border">
            {lowStock.slice(0, 5).map((p: any) => (
              <div
                key={p.id}
                className="py-3 flex items-center justify-between text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Available: {p.quantityOnHand} {p.unit} (Reorder level: {p.reorderLevel})
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="destructive">
                    Shortfall: {p.shortfall}
                  </Badge>
                  {p.estimatedRestockCost > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Est. Cost: {formatMoney(p.estimatedRestockCost)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ReportSectionCard>
      )}
    </div>
  );
}
