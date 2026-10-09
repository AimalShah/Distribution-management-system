import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useSWR from "swr";
import { ArrowLeft, Copy, MessageCircle, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dms/ui";
import { fetcher } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { waLink } from "../lib/whatsapp";
import { ListPageHeader } from "../components/list/ListPageHeader";
import { StatTileRow } from "../components/list/StatTileRow";

interface LedgerEntry {
  date: string;
  type: "invoice" | "credit" | "payment";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  /** When an invoice's balance is payable (issue #48); null on other entries. */
  dueDate?: string | null;
}

interface CustomerLedger {
  customer: { id: string; customerCode: string; name: string; phone: string | null };
  from: string | null;
  to: string | null;
  openingBalance: number;
  entries: LedgerEntry[];
  totals: {
    invoices: number;
    credits: number;
    payments: number;
    closingBalance: number;
  };
}

/**
 * The customer's statement page.
 *
 * Every figure here is read from the derived ledger endpoint — invoices, return
 * credits and payments folded into a running balance — so what the customer is
 * shown is exactly what the accounts show, with no second calculation to drift
 * apart. The WhatsApp button turns the same figures into a compact message and
 * hands it to `wa.me` for review; nothing is sent automatically.
 */
export default function CustomerLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shareBusy, setShareBusy] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (from) params.set("from", from);

    if (to) params.set("to", to);
    const qs = params.toString();

    return qs ? `?${qs}` : "";
  }, [from, to]);

  const { data, isLoading, mutate } = useSWR(
    id ? `/customers/${id}/ledger${queryString}` : null,
    fetcher
  );

  // SAFETY: the fetcher hands back this endpoint's body — the ledger the page
  // renders; it is `any` only because the shared fetcher is not generic.
  const ledger = data as CustomerLedger | undefined;

  const typeBadge = (type: LedgerEntry["type"]) => {
    switch (type) {
      case "invoice":
        return <Badge variant="secondary" className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">Invoice</Badge>;
      case "credit":
        return <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Return</Badge>;
      case "payment":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Payment</Badge>;
      default:
        return null;
    }
  };

  const handleShare = async () => {
    if (!ledger) return;
    setShareBusy(true);

    try {
      const period =
        ledger.from && ledger.to
          ? `${formatDate(ledger.from)} — ${formatDate(ledger.to)}`
          : ledger.from
            ? `From ${formatDate(ledger.from)}`
            : ledger.to
              ? `Up to ${formatDate(ledger.to)}`
              : "All activity to date";

      const text = [
        `Statement — ${ledger.customer.name} (${ledger.customer.customerCode})`,
        period,
        `Opening balance: ${formatMoney(ledger.openingBalance)}`,
        `Invoices: ${formatMoney(ledger.totals.invoices)}`,
        `Returns credited: ${formatMoney(ledger.totals.credits)}`,
        `Payments received: ${formatMoney(ledger.totals.payments)}`,
        `Balance due: ${formatMoney(ledger.totals.closingBalance)}`,
        "",
        "Thank you for your business.",
      ].join("\n");

      const link = waLink(ledger.customer.phone, text);

      if (link) {
        window.open(link, "_blank", "noopener");
      } else {
        await navigator.clipboard.writeText(text);
        toast.info("No WhatsApp number on file — the statement was copied instead");
      }
    } catch {
      toast.error("Failed to prepare the statement");
    } finally {
      setShareBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!ledger) return;

    try {
      const text = ledger.entries
        .map(
          (e) =>
            `${formatDate(e.date)}  ${e.description}  ${e.debit ? `debit ${formatMoney(e.debit)}` : `credit ${formatMoney(e.credit)}`}  balance ${formatMoney(e.balance)}`
        )
        .join("\n");

      await navigator.clipboard.writeText(text);
      toast.success("Ledger copied to the clipboard");
    } catch {
      toast.error("Failed to copy the ledger");
    }
  };

  return (
    <div className="space-y-5 animate-slideInUp">
      <ListPageHeader
        breadcrumb={
          <>
            <Link to="/" className="hover:text-primary transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link to="/customers" className="hover:text-primary transition-colors">
              Customers
            </Link>
            <span>/</span>
            <span className="text-foreground font-semibold">
              {ledger?.customer.name ?? "Statement"}
            </span>
          </>
        }
        title={ledger ? `Statement — ${ledger.customer.name}` : "Statement"}
        subtitle="Invoices, return credits and payments, folded into one running balance"
        actions={
          <>
            <Link to="/customers">
              <Button variant="outline" size="sm" className="btn-secondary h-9 rounded-md cursor-pointer">
                <ArrowLeft className="size-3.5 mr-2" />
                Customers
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              disabled={isLoading}
              className="btn-secondary h-9 rounded-md cursor-pointer"
            >
              <RefreshCw className="size-3.5 mr-2" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => void handleShare()}
              disabled={isLoading || !ledger || shareBusy}
              className="h-9 rounded-md shadow-sm cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <MessageCircle className="size-4 mr-2" />
              Share on WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCopy()}
              disabled={!ledger || ledger.entries.length === 0}
              className="btn-secondary h-9 rounded-md cursor-pointer"
            >
              <Copy className="size-3.5 mr-2" />
              Copy
            </Button>
          </>
        }
      />

      {/* Statement window */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label htmlFor="ledger-from" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            From
          </label>
          <Input
            id="ledger-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 text-xs rounded-lg bg-background mt-1"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="ledger-to" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            To
          </label>
          <Input
            id="ledger-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 text-xs rounded-lg bg-background mt-1"
          />
        </div>
        <p className="text-xs text-muted-foreground sm:pb-2">
          Everything before the window is folded into the opening balance.
        </p>
      </div>

      <StatTileRow
        tiles={[
          {
            label: "Opening balance",
            value: isLoading ? "—" : formatMoney(ledger?.openingBalance ?? 0),
            sublabel: "Owed before this window",
            icon: <Wallet className="size-6" />,
          },
          {
            label: "Invoices",
            value: isLoading ? "—" : formatMoney(ledger?.totals.invoices ?? 0),
            sublabel: "Billed in this window",
            icon: <Wallet className="size-6" />,
            tone: "success",
          },
          {
            label: "Returns credited",
            value: isLoading ? "—" : formatMoney(ledger?.totals.credits ?? 0),
            sublabel: "Goods handed back",
            icon: <Wallet className="size-6" />,
            tone: "warning",
          },
          {
            label: "Payments received",
            value: isLoading ? "—" : formatMoney(ledger?.totals.payments ?? 0),
            sublabel: "Invoices and on account",
            icon: <Wallet className="size-6" />,
            tone: "success",
          },
          {
            label: "Balance due",
            value: isLoading ? "—" : formatMoney(ledger?.totals.closingBalance ?? 0),
            sublabel: "Closing position",
            icon: <Wallet className="size-6" />,
            tone: (ledger?.totals.closingBalance ?? 0) > 0 ? "warning" : "success",
          },
        ]}
      />

      <div className="card p-0 overflow-hidden">
        <div className="p-4 sm:p-5">
          {isLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : (ledger?.entries.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
                <Wallet className="size-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No activity in this window</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Widen the dates to see earlier invoices, returns and payments.
              </p>
            </div>
          ) : (
            <Table className="data-table">
              <TableHeader className="[&_tr]:border-0">
                <TableRow>
                  <TableHead className="h-auto">Date</TableHead>
                  <TableHead className="h-auto">Entry</TableHead>
                  <TableHead className="h-auto">Reference</TableHead>
                  <TableHead className="h-auto text-right">Debit</TableHead>
                  <TableHead className="h-auto text-right">Credit</TableHead>
                  <TableHead className="h-auto text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger?.entries.map((entry) => (
                  <TableRow key={`${entry.type}-${entry.reference}-${entry.date}`}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.date)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {typeBadge(entry.type)}
                        <span className="block text-xs text-muted-foreground">
                          {entry.description}
                        </span>
                        {/* An invoice's balance becomes payable on this date
                            (ADR 0009); only invoice entries carry one. */}
                        {entry.dueDate ? (
                          <span className="block text-xs text-muted-foreground">
                            Due {formatDate(entry.dueDate)}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary">
                      {entry.reference}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {entry.debit > 0 ? formatMoney(entry.debit) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium text-emerald-600">
                      {entry.credit > 0 ? formatMoney(entry.credit) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold">
                      {formatMoney(entry.balance)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* The closing line reconciles the running column with the totals above. */}
                <TableRow>
                  <TableCell className="text-xs font-bold uppercase tracking-wider" colSpan={3}>
                    Closing balance
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold">
                    {formatMoney(ledger?.totals.invoices ?? 0)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold">
                    {formatMoney((ledger?.totals.credits ?? 0) + (ledger?.totals.payments ?? 0))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-bold text-primary">
                    {formatMoney(ledger?.totals.closingBalance ?? 0)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
