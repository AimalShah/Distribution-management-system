import { useMemo } from "react";
import useSWR from "swr";
import { AlertCircle, Clock, DollarSign, AlertTriangle } from "lucide-react";
import { fetcher } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";
import {
  KpiCardGrid,
  ReportSectionCard,
  ReportTabsSkeleton,
} from "./ReportPrimitives";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dms/ui";

interface AgingReportTabProps {
  queryString: string;
}

export interface AgingReportResponse {
  asOfDate: string;
  totalOutstanding: number;
  totalOverdue: number;
  current: number;
  buckets: {
    "0-30": number;
    "31-60": number;
    "61-90": number;
    "90+": number;
  };
  summary: {
    totalOutstanding: number;
    totalOverdue: number;
    current: number;
    buckets: {
      "0-30": number;
      "31-60": number;
      "61-90": number;
      "90+": number;
    };
  };
  byCustomer: Array<{
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
    invoices: Array<{
      id: string;
      saleCode: string;
      saleDate: string;
      dueDate: string | null;
      totalAmount: number;
      amountPaid: number;
      balance: number;
      daysOverdue: number;
      bucket: "current" | "0-30" | "31-60" | "61-90" | "90+";
    }>;
  }>;
  invoices: Array<{
    id: string;
    saleCode: string;
    customerId: string;
    customerName: string;
    customerCode?: string;
    saleDate: string;
    dueDate: string | null;
    totalAmount: number;
    amountPaid: number;
    balance: number;
    daysOverdue: number;
    bucket: "current" | "0-30" | "31-60" | "61-90" | "90+";
  }>;
}

export function AgingReportTab({ queryString }: AgingReportTabProps) {
  const { data, isLoading } = useSWR<AgingReportResponse>(
    `/reports/sales/aging?${queryString}`,
    fetcher
  );

  const buckets = data?.buckets ?? {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };

  const cards = useMemo(
    () => [
      {
        title: "Total Outstanding",
        value: data ? formatMoney(data.totalOutstanding) : "—",
        icon: DollarSign,
        tileClassName: "bg-primary/10 text-primary",
      },
      {
        title: "Total Overdue",
        value: data ? formatMoney(data.totalOverdue) : "—",
        icon: AlertCircle,
        tileClassName: "bg-destructive/10 text-destructive",
      },
      {
        title: "Current (Not Due)",
        value: data ? formatMoney(data.current) : "—",
        icon: Clock,
        tileClassName: "bg-emerald-500/10 text-emerald-600",
      },
      {
        title: "90+ Days Overdue",
        value: data ? formatMoney(buckets["90+"]) : "—",
        icon: AlertTriangle,
        tileClassName: "bg-amber-500/10 text-amber-600",
      },
    ],
    [data, buckets]
  );

  if (isLoading) {
    return <ReportTabsSkeleton />;
  }

  const byCustomer = data?.byCustomer ?? [];
  const invoices = data?.invoices ?? [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <KpiCardGrid cards={cards} />

      {/* Aging Buckets Summary Grid */}
      <ReportSectionCard
        title="Overdue Aging Summary"
        description="Receivables bucketed by days past payment due date (ADR 0009)"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
          <div className="rounded-lg border border-border p-4 bg-card/60">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              0–30 Days Overdue
            </span>
            <p className="text-2xl font-bold mt-2 tabular-nums text-foreground">
              {formatMoney(buckets["0-30"])}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Recently overdue balance</p>
          </div>

          <div className="rounded-lg border border-border p-4 bg-card/60">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              31–60 Days Overdue
            </span>
            <p className="text-2xl font-bold mt-2 tabular-nums text-foreground">
              {formatMoney(buckets["31-60"])}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Second billing cycle past due</p>
          </div>

          <div className="rounded-lg border border-border p-4 bg-card/60">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              61–90 Days Overdue
            </span>
            <p className="text-2xl font-bold mt-2 tabular-nums text-amber-600 dark:text-amber-400">
              {formatMoney(buckets["61-90"])}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Delinquent balances</p>
          </div>

          <div className="rounded-lg border border-destructive/30 p-4 bg-destructive/5">
            <span className="text-xs font-semibold uppercase tracking-wider text-destructive">
              90+ Days Overdue
            </span>
            <p className="text-2xl font-bold mt-2 tabular-nums text-destructive">
              {formatMoney(buckets["90+"])}
            </p>
            <p className="text-xs text-muted-foreground mt-1">High-risk overdue balance</p>
          </div>
        </div>
      </ReportSectionCard>

      {/* Customer Aging Breakdown Table */}
      <ReportSectionCard
        title="Customer Aging Balances"
        description="Outstanding balance and aging buckets grouped by customer"
      >
        {byCustomer.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No overdue or outstanding receivables found for the selected scope.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">0–30 Days</TableHead>
                  <TableHead className="text-right">31–60 Days</TableHead>
                  <TableHead className="text-right">61–90 Days</TableHead>
                  <TableHead className="text-right">90+ Days</TableHead>
                  <TableHead className="text-right font-semibold">Total Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCustomer.map((cust) => (
                  <TableRow key={cust.customerId}>
                    <TableCell>
                      <div className="font-medium text-foreground">{cust.customerName}</div>
                      {cust.customerCode && (
                        <div className="text-xs font-mono text-muted-foreground">
                          {cust.customerCode}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(cust.current)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(cust.buckets["0-30"])}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(cust.buckets["31-60"])}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {formatMoney(cust.buckets["61-90"])}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-destructive">
                      {formatMoney(cust.buckets["90+"])}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-foreground">
                      {formatMoney(cust.totalOutstanding)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ReportSectionCard>

      {/* Individual Invoices Aging Table */}
      <ReportSectionCard
        title="Overdue Invoice Detail"
        description="Open invoices with remaining balances and days overdue"
      >
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No open invoices found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status / Bucket</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right font-semibold">Balance Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {inv.saleCode}
                    </TableCell>
                    <TableCell>{inv.customerName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.dueDate ? formatDate(inv.dueDate) : "No due date"}
                    </TableCell>
                    <TableCell>
                      {inv.bucket === "current" ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">
                          Current (Not Due)
                        </Badge>
                      ) : (
                        <Badge
                          variant={inv.bucket === "90+" ? "destructive" : "secondary"}
                          className="tabular-nums"
                        >
                          {inv.daysOverdue}d overdue ({inv.bucket})
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(inv.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(inv.amountPaid)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-foreground">
                      {formatMoney(inv.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ReportSectionCard>
    </div>
  );
}
