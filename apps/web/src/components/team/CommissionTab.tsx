import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import {
  Calculator,
  Calendar,
  CheckCircle2,
  DollarSign,
  Package,
  Printer,
  RefreshCw,
  TrendingUp,
  User,
  Users,
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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dms/ui";
import { fetcher } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";
import type { MemberRow } from "../settings/MemberDialog";

export interface CommissionTabProps {
  members?: MemberRow[];
  selectedSalesmanId?: string;
  onSelectSalesman?: (id: string) => void;
}

export function CommissionTab({
  members = [],
  selectedSalesmanId,
  onSelectSalesman,
}: CommissionTabProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [commissionRate, setCommissionRate] = useState("1.00");

  // Filter members for salesmen (role includes sales or is member)
  const salesmen = useMemo(() => {
    const list = members.filter(
      (m) => m.role?.toLowerCase().includes("sales") || m.role === "member"
    );
    return list.length > 0 ? list : members;
  }, [members]);

  const [selectedId, setSelectedId] = useState<string>(() => {
    return selectedSalesmanId || salesmen[0]?.user.id || "";
  });

  useEffect(() => {
    if (selectedSalesmanId) {
      setSelectedId(selectedSalesmanId);
    } else if (!selectedId && salesmen.length > 0) {
      setSelectedId(salesmen[0].user.id);
    }
  }, [selectedSalesmanId, salesmen, selectedId]);

  const handleSalesmanChange = (newId: string) => {
    setSelectedId(newId);
    onSelectSalesman?.(newId);
  };

  const currentSalesman = useMemo(
    () => salesmen.find((s) => s.user.id === selectedId),
    [salesmen, selectedId]
  );

  const queryString = useMemo(() => {
    if (!selectedId) return null;
    const params = new URLSearchParams({ salesmanId: selectedId });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  }, [selectedId, startDate, endDate]);

  const { data, isLoading, mutate } = useSWR(
    queryString ? `/sales/salesman-summary?${queryString}` : null,
    fetcher
  );

  const totalPacks = data?.totalPacks ?? 0;
  const rate = Number(commissionRate) || 0;
  const totalCommissionDue = totalPacks * rate;
  const sales = data?.sales ?? [];

  if (salesmen.length === 0) {
    return (
      <Card className="rounded-md border border-border shadow-none">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="size-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-semibold text-foreground">No Salesmen Found</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            Add team members with the Salesman role under Members & Staff to start calculating physical pack-based commissions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Printable Header (Visible only when printed) */}
      <div className="hidden print:block text-center border-b border-border pb-4 mb-4">
        <h2 className="text-2xl font-bold tracking-tight">AM-ENTERPRISES</h2>
        <p className="text-sm font-semibold mt-0.5">Salesman Commission Summary Report</p>
        <div className="text-xs text-muted-foreground mt-2 flex justify-center gap-4">
          <span><strong>Salesman:</strong> {currentSalesman?.user.name} ({currentSalesman?.user.email})</span>
          {startDate || endDate ? (
            <span><strong>Period:</strong> {startDate || "Beginning"} to {endDate || "Today"}</span>
          ) : null}
          <span><strong>Rate:</strong> {formatMoney(rate)} / pack</span>
        </div>
      </div>

      {/* Control Panel: Salesman Picker + Date Range + Rate */}
      <Card className="rounded-md border border-border shadow-none print:hidden">
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Calculator className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Commission Calculator</CardTitle>
                <CardDescription className="text-xs">
                  Compute physical pack-based commission for completed sales invoices
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => mutate()}
                disabled={isLoading}
              >
                <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => window.print()}
                disabled={sales.length === 0}
              >
                <Printer className="size-3.5" />
                Print Summary
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="commission-salesman-select" className="text-xs font-medium">
                Salesman
              </Label>
              <Select value={selectedId} onValueChange={handleSalesmanChange}>
                <SelectTrigger id="commission-salesman-select" className="h-8 text-xs">
                  <SelectValue placeholder="Select salesman" />
                </SelectTrigger>
                <SelectContent>
                  {salesmen.map((salesman) => (
                    <SelectItem key={salesman.user.id} value={salesman.user.id}>
                      {salesman.user.name} ({salesman.user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="commission-start-date" className="text-xs font-medium">
                Start Date
              </Label>
              <Input
                id="commission-start-date"
                type="date"
                className="h-8 text-xs"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="commission-end-date" className="text-xs font-medium">
                End Date
              </Label>
              <Input
                id="commission-end-date"
                type="date"
                className="h-8 text-xs"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="commission-rate-input" className="text-xs font-medium">
                Commission Rate per Pack
              </Label>
              <div className="relative">
                <Input
                  id="commission-rate-input"
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-8 text-xs font-mono"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border-border bg-card shadow-none">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Completed Invoices
          </p>
          <p className="text-xl font-bold text-foreground mt-1">
            {isLoading ? "..." : (data?.totalInvoices ?? 0)}
          </p>
        </Card>

        <Card className="p-3 border-border bg-card shadow-none">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Total Packs Sold
          </p>
          <p className="text-xl font-bold text-foreground mt-1">
            {isLoading ? "..." : `${totalPacks.toLocaleString()} packs`}
          </p>
        </Card>

        <Card className="p-3 border-border bg-card shadow-none">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Total Revenue
          </p>
          <p className="text-xl font-bold text-foreground mt-1">
            {isLoading ? "..." : formatMoney(data?.totalAmount ?? 0)}
          </p>
        </Card>

        <Card className="p-3 border-emerald-500/30 bg-emerald-500/5 shadow-none">
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            Commission Due
          </p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {isLoading ? "..." : formatMoney(totalCommissionDue)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {totalPacks.toLocaleString()} packs × {formatMoney(rate)}
          </p>
        </Card>
      </div>

      {/* Itemized Sales Invoices Table */}
      <Card className="rounded-md border border-border shadow-none">
        <CardHeader className="py-3 px-4 sm:px-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Itemized Sales Invoices ({sales.length})
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Completed invoices included in commission computation for {currentSalesman?.user.name ?? "Selected Salesman"}
              </CardDescription>
            </div>
            {totalCommissionDue > 0 ? (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                Due: {formatMoney(totalCommissionDue)}
              </Badge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-xs">Code</TableHead>
                <TableHead className="font-semibold text-xs">Date</TableHead>
                <TableHead className="font-semibold text-xs">Customer</TableHead>
                <TableHead className="font-semibold text-xs text-right">Packs Sold</TableHead>
                <TableHead className="font-semibold text-xs text-right">Invoice Total</TableHead>
                <TableHead className="font-semibold text-xs text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                    <RefreshCw className="size-4 animate-spin mx-auto mb-2 text-muted-foreground/60" />
                    Loading commission data...
                  </TableCell>
                </TableRow>
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                    No completed sales found for this salesman in the selected period.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale: any) => {
                  const salePacks = sale.packs ?? 0;
                  const saleCommission = salePacks * rate;
                  return (
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
                        {salePacks.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatMoney(sale.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(saleCommission)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
