import { useMemo } from "react";
import useSWR from "swr";
import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle2, ArrowRight, RefreshCw, TriangleAlert } from "lucide-react";
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

export interface ExpiringBatchItem {
  id: string;
  batchNumber: string;
  productId: string;
  productName: string;
  productCode: string;
  unit?: string;
  expiryDate: string;
  daysUntilExpiry: number;
  isExpired: boolean;
  quantityRemaining: number;
}

export function ExpiringSoonCard() {
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    error,
    mutate,
  } = useSWR<ExpiringBatchItem[]>(
    "/inventory/batches/expiring?days=30&limit=5",
    fetcher
  );

  const batches = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const expiredCount = useMemo(() => batches.filter((b) => b.isExpired).length, [batches]);
  const expiringCount = batches.length - expiredCount;

  return (
    <Card className="flex flex-col h-full border-border bg-card py-3 gap-3">
      {/* Header */}
      <CardHeader className="px-4 py-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-4 shrink-0" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate leading-tight">
                Expiring Soon
              </CardTitle>
              <p className="text-[11px] text-muted-foreground truncate">
                Batches within 30-day window
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {expiredCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-medium shrink-0">
                {expiredCount} expired
              </Badge>
            )}
            {expiringCount > 0 && (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0.5 font-medium shrink-0"
              >
                {expiringCount} soon
              </Badge>
            )}
            {!isLoading && !error && batches.length === 0 && (
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
            <TriangleAlert className="size-6 text-destructive" />
            <p className="text-xs text-muted-foreground">Expiry data unavailable</p>
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
        ) : batches.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-muted-foreground">
            <CheckCircle2 className="size-7 text-emerald-500/80 mb-1.5" />
            <p className="text-xs font-medium text-foreground">All batches in good standing</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px] truncate">
              No inventory batches expiring within 30 days.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {batches.slice(0, 4).map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 border border-border/40 shadow-2xs transition-colors"
              >
                {/* Left Column: Product & Batch */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate leading-tight">
                    {b.productName}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
                    <span className="truncate max-w-[90px]">{b.batchNumber}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="shrink-0">{b.quantityRemaining} {b.unit || "pcs"}</span>
                  </div>
                </div>

                {/* Right Column: Days left / Expired badge */}
                <div className="flex items-center shrink-0">
                  {b.isExpired ? (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-mono shrink-0">
                      Expired
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0.5 font-mono shrink-0 ${
                        b.daysUntilExpiry <= 7
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {b.daysUntilExpiry}d left
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-border/60 text-xs">
          <span className="text-[11px] text-muted-foreground">
            {batches.length > 0 ? `${batches.length} flagged batch${batches.length > 1 ? "es" : ""}` : "Up to date"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/inventory?tab=batches")}
            className="h-6 px-1.5 text-xs text-primary hover:text-primary gap-1 font-medium"
          >
            <span>Batches</span>
            <ArrowRight className="size-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
