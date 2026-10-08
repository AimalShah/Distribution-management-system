import { useMemo } from "react";
import useSWR from "swr";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Expiring Soon</CardTitle>
              <CardDescription className="text-xs">
                Batches expiring within the next 30 days (FEFO)
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={batches.length > 0 ? "outline" : "secondary"}
            className={
              batches.length > 0
                ? "bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs"
                : "text-xs"
            }
          >
            {isLoading || error
              ? "—"
              : `${batches.length} ${batches.length === 1 ? "Batch" : "Batches"}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-2 py-6 text-center"
          >
            <TriangleAlert className="size-6 text-destructive" />
            <p className="text-xs text-muted-foreground">
              Expiry data unavailable
            </p>
            <button
              type="button"
              onClick={() => void mutate()}
              className="btn btn-outline btn-sm cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="size-3.5" />
              Retry
            </button>
          </div>
        ) : batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
            <CheckCircle2 className="size-8 text-emerald-500/80 mb-2" />
            <p className="text-xs font-medium text-foreground">All batches in good standing</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              No inventory batches expiring within the next 30 days.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="text-xs">Batch</TableHead>
                    <TableHead className="text-xs text-right">Remaining</TableHead>
                    <TableHead className="text-xs text-right">Expires In</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => (
                    <TableRow key={b.id} className="text-xs">
                      <TableCell className="font-medium max-w-[140px] truncate">
                        <div>{b.productName}</div>
                        <div className="text-[10px] text-muted-foreground">{b.productCode}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {b.batchNumber}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {b.quantityRemaining} {b.unit || "units"}
                      </TableCell>
                      <TableCell className="text-right">
                        {b.isExpired ? (
                          <Badge
                            variant="destructive"
                            className="text-[10px] px-1.5 py-0.5"
                          >
                            Expired
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] px-1.5 py-0.5"
                          >
                            {b.daysUntilExpiry}d left
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/inventory?tab=batches")}
                className="text-xs gap-1 h-7 text-primary hover:text-primary"
              >
                <span>View All Batches</span>
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
