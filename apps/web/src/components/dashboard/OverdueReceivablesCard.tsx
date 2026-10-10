import { useMemo } from "react";
import useSWR from "swr";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
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
import { formatMoney } from "../../lib/format";

interface CustomerAgingSummary {
  customerId: string;
  customerName: string;
  customerCode?: string;
  totalOutstanding: number;
  totalOverdue: number;
  current: number;
  buckets: {
    "0-30": number;
    "31-60": number;
    "61-90": number;
    "90+": number;
  };
}

interface AgingReportResponse {
  totalOutstanding: number;
  totalOverdue: number;
  byCustomer: CustomerAgingSummary[];
}

export function OverdueReceivablesCard() {
  const { data, isLoading, error, mutate } = useSWR<AgingReportResponse>(
    "/reports/sales/aging",
    fetcher
  );

  const topOverdue = useMemo(() => {
    if (!data?.byCustomer) return [];

    return data.byCustomer
      .filter((c) => c.totalOverdue > 0)
      .sort((a, b) => b.totalOverdue - a.totalOverdue)
      .slice(0, 5);
  }, [data?.byCustomer]);

  return (
    <Card className="flex flex-col h-full border-border bg-card py-3 gap-3">
      {/* Header */}
      <CardHeader className="px-4 py-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate leading-tight">
                Overdue Receivables
              </CardTitle>
              <p className="text-[11px] text-muted-foreground truncate">
                Customer payments past due
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {data?.totalOverdue !== undefined && data.totalOverdue > 0 ? (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-mono shrink-0">
                {formatMoney(data.totalOverdue)}
              </Badge>
            ) : !isLoading && !error ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-emerald-600 border-emerald-500/20 bg-emerald-500/10 shrink-0">
                Current
              </Badge>
            ) : null}
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
            <AlertCircle className="size-6 text-destructive" />
            <p className="text-xs text-muted-foreground">Aging receivables unavailable</p>
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
        ) : topOverdue.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-muted-foreground">
            <CheckCircle2 className="size-7 text-emerald-500/80 mb-1.5" />
            <p className="text-xs font-medium text-foreground">No overdue receivables</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px] truncate">
              All customer ledger accounts are within terms.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {topOverdue.slice(0, 4).map((c) => (
              <div
                key={c.customerId}
                className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 border border-border/40 shadow-2xs transition-colors"
              >
                {/* Left Column: Customer Name & Code */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate leading-tight">
                    {c.customerName}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
                    <span className="truncate max-w-[90px]">{c.customerCode || "Acc"}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="shrink-0">Tot: {formatMoney(c.totalOutstanding)}</span>
                  </div>
                </div>

                {/* Right Column: Overdue amount + Ledger link */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold font-mono text-red-600 dark:text-red-400 shrink-0">
                    {formatMoney(c.totalOverdue)}
                  </span>
                  <Link
                    to={`/customers/${c.customerId}/ledger`}
                    className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline font-medium bg-background hover:bg-muted border border-border/60 px-1.5 py-1 rounded transition-colors shrink-0"
                    title={`View ${c.customerName} ledger`}
                  >
                    <span>Ledger</span>
                    <ArrowRight className="size-2.5 shrink-0" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-border/60 text-xs">
          <span className="text-[11px] text-muted-foreground">
            {topOverdue.length > 0 ? `${topOverdue.length} overdue account${topOverdue.length > 1 ? "s" : ""}` : "Up to date"}
          </span>
          <Link
            to="/reports?tab=aging"
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary font-medium"
          >
            <span>Aging Report</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
