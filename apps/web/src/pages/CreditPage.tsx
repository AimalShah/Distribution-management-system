import { Link } from "react-router-dom";
import useSWR from "swr";
import {
  BookText,
  Landmark,
  RefreshCw,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { Badge, Button, Card, CardContent, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger } from "@dms/ui";
import { fetcher } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { PageHead } from "../components/list/PageHead";
import { StatTileRow } from "../components/list/StatTileRow";
import { LoadErrorState } from "../components/list/LoadErrorState";

interface CreditCustomerRow {
  customerId: string;
  name: string;
  customerCode: string;
  creditLimit: number;
  balanceDue: number;
  overdue: number;
  oldestOverdueAt?: string | null;
  storeCredit: number;
}

interface CreditOverview {
  asOfDate: string;
  summary: {
    balanceDue: number;
    overdue: number;
    totalStoreCredit: number;
    overLimitCount: number;
  };
  customers: CreditCustomerRow[];
}

interface AgingReport {
  totalOutstanding: number;
  totalOverdue: number;
  current: number;
  buckets: { "0-30": number; "31-60": number; "61-90": number; "90+": number };
  invoices: {
    id: string;
    saleCode: string;
    customerId: string;
    customerName: string;
    saleDate: string;
    dueDate: string | null;
    balance: number;
    daysOverdue: number;
    bucket: "current" | "0-30" | "31-60" | "61-90" | "90+";
  }[];
}

/**
 * The "Credit" section (GLOSSARY.md): what customers owe us ("balance due",
 * with due dates and the overdue part), what we owe them ("store credit"),
 * and who has gone past the maximum a customer is allowed to owe.
 */
export default function CreditPage() {
  const { data, error, isLoading, mutate } = useSWR<CreditOverview>("/credit", fetcher);

  const { data: aging, error: agingError, isLoading: agingLoading } = useSWR<AgingReport>(
    "/reports/sales/aging",
    fetcher
  );

  return (
    <div className="space-y-5 animate-slideInUp">
      <PageHead
        breadcrumb={
          <>
            <Link to="/" className="hover:text-primary transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-foreground font-semibold">Credit</span>
          </>
        }
        title="Credit"
        subtitle="What customers owe you, what is overdue, and the store credit they hold"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className="size-3.5 mr-2" />
            Refresh
          </Button>
        }
      />

      {error ? (
        <LoadErrorState error={error} onRetry={() => void mutate()} />
      ) : isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <StatTileRow
            tiles={[
              {
                label: "Balance due",
                value: formatMoney(data?.summary.balanceDue ?? 0),
                sublabel: "Everything customers still owe",
                icon: <Landmark />,
                tone: "info",
              },
              {
                label: "Overdue",
                value: formatMoney(data?.summary.overdue ?? 0),
                sublabel: "Past the payment deadline",
                icon: <TriangleAlert />,
                tone: "destructive",
              },
              {
                label: "Store credit held",
                value: formatMoney(data?.summary.totalStoreCredit ?? 0),
                sublabel: "We owe this to customers (from returns)",
                icon: <WalletCards />,
                tone: "purple",
              },
              {
                label: "At or over their maximum",
                value: String(data?.summary.overLimitCount ?? 0),
                sublabel: "Customers whose balance reached the maximum you allow",
                icon: <TriangleAlert />,
                tone: "warning",
              },
            ]}
          />

          <Tabs defaultValue="customers">
            <TabsList>
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="invoices">Outstanding invoices</TabsTrigger>
            </TabsList>

            <TabsContent value="customers">
              <Card className="py-0 gap-0">
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Balance due</TableHead>
                        <TableHead className="text-right">Overdue part</TableHead>
                        <TableHead>Printout due since</TableHead>
                        <TableHead className="text-right">Maximum allowed</TableHead>
                        <TableHead className="text-right">Store credit held</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.customers ?? []).map((customer) => {
                        const overLimit =
                          customer.creditLimit > 0 &&
                          customer.balanceDue >= customer.creditLimit;

                        return (
                          <TableRow key={customer.customerId}>
                            <TableCell>
                              <div className="min-w-[130px]">
                                <span className="block truncate text-sm font-semibold text-foreground">
                                  {customer.name}
                                </span>
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  {customer.customerCode}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                              {customer.balanceDue > 0 ? formatMoney(customer.balanceDue) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm tabular-nums">
                              {customer.overdue > 0 ? (
                                <span className="font-semibold text-destructive">{formatMoney(customer.overdue)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {customer.oldestOverdueAt ? formatDate(customer.oldestOverdueAt) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {customer.creditLimit > 0 ? (
                                <span className={overLimit ? "font-semibold text-destructive" : ""}>
                                  {formatMoney(customer.creditLimit)}
                                  {overLimit && " · reached"}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">No maximum</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm tabular-nums">
                              {customer.storeCredit > 0 ? formatMoney(customer.storeCredit) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button asChild variant="outline" size="sm" className="h-8">
                                <Link to={`/customers/${customer.customerId}/ledger`}>
                                  <BookText className="size-3.5 mr-1.5" />
                                  Ledger
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(data?.customers ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                            No active customers yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices">
              {agingError ? (
                <LoadErrorState error={agingError} onRetry={() => void mutate()} compact />
              ) : agingLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ) : (
                <Card className="py-0 gap-0">
                  <CardContent className="p-4 grid grid-cols-3 gap-3 text-center border-b">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Days overdue</p>
                      <div className="text-lg font-bold">{formatMoney(aging?.buckets["0-30"] ?? 0)}</div>
                      <p className="text-[11px] text-muted-foreground">0–30</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">1–3 months late</p>
                      <div className="text-lg font-bold">{formatMoney((aging?.buckets["31-60"] ?? 0) + (aging?.buckets["61-90"] ?? 0))}</div>
                      <p className="text-[11px] text-muted-foreground">31–90</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Worth chasing first</p>
                      <div className="text-lg font-bold font-mono text-destructive">{formatMoney(aging?.buckets["90+"] ?? 0)}</div>
                      <p className="text-[11px] text-muted-foreground">90+ days</p>
                    </div>
                  </CardContent>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Due date</TableHead>
                          <TableHead className="text-right">Balance due</TableHead>
                          <TableHead className="text-right">Days overdue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(aging?.invoices ?? []).map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono text-xs font-semibold text-primary">
                              {invoice.saleCode}
                            </TableCell>
                            <TableCell className="text-sm">{invoice.customerName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                              {formatMoney(invoice.balance)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {invoice.bucket === "current" ? (
                                <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                  Not due yet
                                </Badge>
                              ) : (
                                <span className={invoice.bucket === "90+" ? "font-semibold text-destructive" : "text-amber-700 dark:text-amber-400"}>
                                  {invoice.daysOverdue}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(aging?.invoices ?? []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                              Nothing outstanding — every invoice is fully paid.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

