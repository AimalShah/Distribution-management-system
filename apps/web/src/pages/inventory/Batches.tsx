import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Boxes,
  Clock,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dms/ui";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export interface BatchItem {
  id: string;
  batchNumber: string;
  productId: string;
  expiryDate?: string | null;
  quantityRemaining: number;
  quantityReceived: number;
  unitCost: number;
  receivedAt: string;
  daysUntilExpiry?: number | null;
  isExpired?: boolean;
  product?: {
    id: string;
    name: string;
    productCode: string;
    unit?: string;
    unitCost?: number;
  };
}

export function Batches() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [filterExpiring, setFilterExpiring] = useState<string>("all");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search.trim()) params.set("search", search.trim());
    if (filterExpiring !== "all") {
      params.set("expiringWithinDays", filterExpiring);
    }
    return params.toString();
  }, [page, pageSize, search, filterExpiring]);

  const { data, isLoading, mutate } = useSWR(
    `/inventory/batches?${queryParams}`,
    fetcher,
    { fallbackData: { data: [], total: 0, pageCount: 1 } }
  );

  const batches: BatchItem[] = useMemo(() => {
    if (data?.data && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  }, [data?.data]);

  const total = data?.total ?? 0;
  const pageCount = data?.pageCount ?? 1;

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by batch # or product name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Select
            value={filterExpiring}
            onValueChange={(val) => {
              setFilterExpiring(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Expiry window" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              <SelectItem value="30">Within 30 Days</SelectItem>
              <SelectItem value="60">Within 60 Days</SelectItem>
              <SelectItem value="90">Within 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Batches Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Stock Batches & Lots</CardTitle>
              <CardDescription className="text-xs">
                Granular batch-level tracking with First-Expired First-Out (FEFO) lifecycle
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {total} Total Batches
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Boxes className="size-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">No stock batches found</p>
              <p className="text-xs mt-0.5">
                Batches are created automatically when purchases with batch numbers are received.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-semibold text-xs">Batch Number</TableHead>
                      <TableHead className="font-semibold text-xs">Product</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Remaining</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Received</TableHead>
                      <TableHead className="font-semibold text-xs">Expiry Date</TableHead>
                      <TableHead className="font-semibold text-xs">Status</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Unit Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => {
                      const isExpired = Boolean(batch.isExpired);
                      const isNear =
                        batch.daysUntilExpiry !== null &&
                        batch.daysUntilExpiry !== undefined &&
                        batch.daysUntilExpiry <= 30 &&
                        !isExpired;

                      return (
                        <TableRow key={batch.id} className="text-xs">
                          <TableCell className="font-mono font-semibold text-foreground">
                            {batch.batchNumber}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">
                              {batch.product?.name || "Unknown Product"}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {batch.product?.productCode}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <span
                              className={
                                batch.quantityRemaining === 0
                                  ? "text-muted-foreground"
                                  : "text-foreground"
                              }
                            >
                              {batch.quantityRemaining}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1">
                              {batch.product?.unit || "units"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {batch.quantityReceived}
                          </TableCell>
                          <TableCell>
                            {batch.expiryDate
                              ? formatDate(batch.expiryDate)
                              : "No Expiry"}
                          </TableCell>
                          <TableCell>
                            {isExpired ? (
                              <Badge
                                variant="destructive"
                                className="text-[10px] px-1.5 py-0.5"
                              >
                                Expired ({Math.abs(batch.daysUntilExpiry ?? 0)}d ago)
                              </Badge>
                            ) : isNear ? (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] px-1.5 py-0.5"
                              >
                                {batch.daysUntilExpiry}d left
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] px-1.5 py-0.5"
                              >
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${Number(batch.unitCost).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination controls */}
              {pageCount > 1 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <div>
                    Page {page} of {pageCount} ({total} batches)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="h-7 text-xs px-2.5"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      disabled={page >= pageCount}
                      className="h-7 text-xs px-2.5"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Batches;
