import { useMemo } from "react";
import useSWR from "swr";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, PlusCircle, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@dms/ui";
import { fetcher } from "../../lib/api";
import type { LowStockRow } from "../../lib/dashboard";

interface LowStockApiResponse {
  data: LowStockRow[];
  total: number;
}

export function StockShortagesCard() {
  const navigate = useNavigate();

  const { data, isLoading, error, mutate } = useSWR<LowStockApiResponse>(
    "/inventory/low-stock?page=1&pageSize=100",
    fetcher
  );

  const lowRows = useMemo(() => data?.data ?? [], [data?.data]);
  const outOfStockCount = useMemo(
    () => lowRows.filter((r) => r.quantityOnHand <= 0).length,
    [lowRows]
  );
  const lowStockCount = lowRows.length - outOfStockCount;

  return (
    <Card className="flex flex-col h-full border-border bg-card py-3 gap-3">
      {/* Header */}
      <CardHeader className="px-4 py-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-4 shrink-0" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate leading-tight">
                Stock Shortages
              </CardTitle>
              <p className="text-[11px] text-muted-foreground truncate">
                Inventory below reorder point
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {outOfStockCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-medium shrink-0">
                {outOfStockCount} zero
              </Badge>
            )}
            {lowStockCount > 0 && (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0.5 font-medium shrink-0"
              >
                {lowStockCount} low
              </Badge>
            )}
            {!isLoading && !error && lowRows.length === 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-emerald-600 border-emerald-500/20 bg-emerald-500/10 shrink-0">
                Healthy
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="flex flex-1 flex-col justify-between px-4 pt-1 pb-0">
        {isLoading ? (
          <div className="space-y-2 py-1">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center"
          >
            <AlertTriangle className="size-6 text-destructive" />
            <p className="text-xs text-muted-foreground">Shortages data unavailable</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void mutate()}
              className="h-7 text-xs gap-1.5"
            >
              <RefreshCw className="size-3" />
              Retry
            </Button>
          </div>
        ) : lowRows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-muted-foreground">
            <CheckCircle2 className="size-7 text-emerald-500/80 mb-1.5" />
            <p className="text-xs font-medium text-foreground">Stock levels healthy</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px] truncate">
              All tracked items meet or exceed reorder thresholds.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {lowRows.slice(0, 4).map((row) => {
              const isOut = row.quantityOnHand <= 0;
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 border border-border/40 shadow-2xs transition-colors"
                >
                  {/* Left Column: Product Name & Code */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate leading-tight">
                      {row.product?.name ?? "Unknown Item"}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
                      <span className="truncate max-w-[90px]">{row.product?.productCode ?? "—"}</span>
                      <span className="text-muted-foreground/40">•</span>
                      <span className="shrink-0">Min: {row.reorderLevel}</span>
                    </div>
                  </div>

                  {/* Right Column: Status pill + Reorder quick action */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant={isOut ? "destructive" : "secondary"}
                      className={`text-[10px] px-1.5 py-0.5 font-mono shrink-0 ${
                        !isOut ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" : ""
                      }`}
                    >
                      {isOut ? "0 on hand" : `${row.quantityOnHand} left`}
                    </Badge>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5 text-[10px] gap-1 shrink-0 font-medium bg-background hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => navigate("/purchases/new")}
                      title="Create purchase order to reorder"
                    >
                      <PlusCircle className="size-3 shrink-0" />
                      <span>PO</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-border/60 text-xs">
          <span className="text-[11px] text-muted-foreground">
            {lowRows.length > 0 ? `${lowRows.length} total shortage${lowRows.length > 1 ? "s" : ""}` : "Up to date"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/inventory")}
            className="h-6 px-1.5 text-xs text-primary hover:text-primary gap-1 font-medium"
          >
            <span>Inventory</span>
            <ArrowRight className="size-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
