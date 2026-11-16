import { useState, useMemo } from "react";
import useSWR from "swr";
import { Calculator, Calendar, DollarSign, Package, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from "@dms/ui";
import { fetcher } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";

export interface SalesmanCommissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesman: {
    id: string;
    name: string;
    email?: string;
  } | null;
}

export function SalesmanCommissionModal({
  open,
  onOpenChange,
  salesman,
}: SalesmanCommissionModalProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [commissionRate, setCommissionRate] = useState("1.00");

  const queryString = useMemo(() => {
    if (!salesman?.id) return null;
    const params = new URLSearchParams({ salesmanId: salesman.id });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  }, [salesman?.id, startDate, endDate]);

  const { data, isLoading } = useSWR(
    open && queryString ? `/sales/salesman-summary?${queryString}` : null,
    fetcher
  );

  const totalPacks = data?.totalPacks ?? 0;
  const rate = Number(commissionRate) || 0;
  const totalCommissionDue = totalPacks * rate;
  const sales = data?.sales ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Calculator className="size-5 text-primary" />
            <DialogTitle>Commission Calculator: {salesman?.name}</DialogTitle>
          </div>
          <DialogDescription>
            Compute physical pack-based commission for completed sales orders.
          </DialogDescription>
        </DialogHeader>

        {/* Filter & Rate Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg border border-border">
          <div className="space-y-1.5">
            <Label htmlFor="start-date" className="text-xs font-medium">
              Start Date
            </Label>
            <Input
              id="start-date"
              type="date"
              className="h-8 text-xs"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="end-date" className="text-xs font-medium">
              End Date
            </Label>
            <Input
              id="end-date"
              type="date"
              className="h-8 text-xs"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commission-rate" className="text-xs font-medium">
              Commission Rate per Pack
            </Label>
            <Input
              id="commission-rate"
              type="number"
              step="0.01"
              min="0"
              className="h-8 text-xs font-mono"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Completed Invoices
            </p>
            <p className="text-lg font-bold text-foreground mt-1">
              {isLoading ? "..." : (data?.totalInvoices ?? 0)}
            </p>
          </Card>

          <Card className="p-3 border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Packs Sold
            </p>
            <p className="text-lg font-bold text-foreground mt-1">
              {isLoading ? "..." : `${totalPacks.toLocaleString()} packs`}
            </p>
          </Card>

          <Card className="p-3 border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Revenue
            </p>
            <p className="text-lg font-bold text-foreground mt-1">
              {isLoading ? "..." : formatMoney(data?.totalAmount ?? 0)}
            </p>
          </Card>

          <Card className="p-3 border-emerald-500/30 bg-emerald-500/5">
            <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Commission Due
            </p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">
              {isLoading ? "..." : formatMoney(totalCommissionDue)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {totalPacks} packs × {formatMoney(rate)}
            </p>
          </Card>
        </div>

        {/* Itemized Sales Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Included Sales Invoices ({sales.length})
          </h4>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold text-xs">Code</TableHead>
                  <TableHead className="font-semibold text-xs">Date</TableHead>
                  <TableHead className="font-semibold text-xs">Customer</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Packs</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Invoice Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                      {isLoading ? "Loading sales orders..." : "No completed sales found for the selected period."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sales.map((sale: any) => (
                    <TableRow key={sale.id} className="text-xs">
                      <TableCell className="font-mono font-medium text-primary">
                        {sale.saleCode}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(sale.saleDate)}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {sale.customerName}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {sale.packs}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatMoney(sale.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
