import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useSWR from "swr";
import { CreditCard, Download, Plus, Receipt, RefreshCw, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
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
import { api, failureMessage, fetcher } from "../lib/api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatDate, formatMoney } from "../lib/format";
import { generateCode } from "../lib/code";
import { PageHead } from "../components/list/PageHead";
import { StatTileRow } from "../components/list/StatTileRow";
import { PaymentMethods, type PaymentMethodValue } from "@dms/shared";

const METHODS: readonly PaymentMethodValue[] = PaymentMethods;

interface PaymentRow {
  id: string;
  paymentCode: string;
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
  paidAt: string;
  saleId: string | null;
  deletedAt: string | null;
  customer: { id: string; customerCode: string; name: string };
  sale: { id: string; saleCode: string; totalAmount: number; amountPaid: number } | null;
  user: { name: string; email: string } | null;
}

interface CustomerOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface SaleOption {
  id: string;
  saleCode: string;
  saleDate: string;
  totalAmount: number;
  amountPaid: number;
}

/** The wire body for POST /payments; optional fields are only sent when set. */
interface PaymentBody {
  paymentCode: string;
  customerId: string;
  saleId?: string;
  amount: number;
  method: PaymentMethodValue;
  reference?: string;
  note?: string;
  paidAt?: string;
}

// SAFETY: "Cash" is the first member of the PaymentMethods allowlist below,
// which PaymentMethodValue is derived from.
const emptyDraft = () => ({
  customerId: "",
  saleId: "", // "" means on account (no invoice).
  amount: "",
  method: "Cash" as PaymentMethodValue,
  reference: "",
  note: "",
  paidAt: "",
});

/**
 * The payments page: money in, and the correction path for it.
 *
 * A payment either settles a named invoice (`saleId`) or lands on the customer's
 * account unallocated; the list shows both. Deleting a payment is a correction —
 * the row is stamped, `Sale.amountPaid` moves back with it, and the invoice
 * returns to unpaid — so it goes through the shared ConfirmDialog rather than a
 * native confirm, and the server re-checks the balance arithmetic either way.
 */
export default function PaymentsPage() {
  const [deletedView, setDeletedView] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<PaymentRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const { data, isLoading, mutate } = useSWR(
    `/payments?pageSize=100${deletedView ? "&deleted=true" : ""}`,
    fetcher
  );

  const { data: customerData } = useSWR(
    dialogOpen ? "/customers?pageSize=100" : null,
    fetcher
  );

  const { data: saleData } = useSWR(
    dialogOpen && draft.customerId ? `/sales/customer/${draft.customerId}?pageSize=100` : null,
    fetcher
  );

  // SAFETY: the fetcher hands back this endpoint's list envelope; the rows are
  // the records the table renders (`any` only because fetcher is not generic).
  const rows = (data?.data ?? []) as PaymentRow[];
  // SAFETY: the fetcher hands back the customers list envelope the dialog reads.
  const customers = ((customerData?.data ?? []) as CustomerOption[]).filter((c) => c.isActive);
  // SAFETY: the fetcher hands back this customer's sales list envelope.
  const sales = ((saleData?.data ?? []) as SaleOption[]).filter((s) => s.amountPaid < s.totalAmount);

  const collected = rows.reduce((sum, row) => sum + row.amount, 0);
  const onAccount = rows.filter((row) => row.saleId === null).reduce((s, r) => s + r.amount, 0);

  const selectedSale = useMemo(
    () => sales.find((s) => s.id === draft.saleId) ?? null,
    [sales, draft.saleId]
  );

  const amountNumber = Number(draft.amount);
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const maxPayment = selectedSale ? selectedSale.totalAmount - selectedSale.amountPaid : null;
  const overPayment = maxPayment !== null && amountValid && amountNumber > maxPayment;

  const canSubmit =
    draft.customerId !== "" && amountValid && !overPayment && !saving;

  const handleCreate = async () => {
    setSaving(true);

    try {
      const payload: PaymentBody = {
        paymentCode: generateCode("PMT"),
        customerId: draft.customerId,
        amount: amountNumber,
        method: draft.method,
      };

      if (draft.saleId) {
        payload.saleId = draft.saleId;
      }

      if (draft.reference) {
        payload.reference = draft.reference;
      }

      if (draft.note) {
        payload.note = draft.note;
      }

      if (draft.paidAt) {
        payload.paidAt = draft.paidAt;
      }

      await api.post("/payments", payload);
      toast.success("Payment recorded");
      setDialogOpen(false);
      setDraft(emptyDraft());
      await mutate();
    } catch (err: any) {
      toast.error(failureMessage(err, "Failed to record payment"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);

    try {
      await api.delete(`/payments/${confirmTarget.id}`);
      toast.success("Payment reversed — the invoice balance was moved back");
      setConfirmTarget(null);
      await mutate();
    } catch (err: any) {
      toast.error(failureMessage(err, "Failed to delete payment"));
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="space-y-5 animate-slideInUp">
      <PageHead
        title="Payments"
        subtitle="Money received against invoices and on account"
        breadcrumb={
          <>
            <Link to="/" className="hover:text-primary transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-foreground font-semibold">Payments</span>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletedView((v) => !v)}
              className="h-9 rounded-md cursor-pointer"
            >
              {deletedView ? "Active payments" : "Corrected payments"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void mutate()}
              disabled={isLoading}
              className="h-9 rounded-md cursor-pointer"
            >
              <RefreshCw className="size-3.5 mr-2" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="h-9 rounded-md shadow-sm cursor-pointer"
            >
              <Plus className="size-4 mr-2" />
              Record payment
            </Button>
          </>
        }
      />

      <StatTileRow
        tiles={[
          {
            label: deletedView ? "Corrected payments" : "Payments",
            value: isLoading ? "—" : (data?.total ?? 0),
            sublabel: "Rows on this view",
            icon: <Wallet className="size-6" />,
            tone: "neutral",
          },
          {
            label: "Collected",
            value: isLoading ? "—" : formatMoney(collected),
            sublabel: "Shown rows",
            icon: <CreditCard className="size-6" />,
            tone: "success",
            sublabelTone: "success",
          },
          {
            label: "On account",
            value: isLoading ? "—" : formatMoney(onAccount),
            sublabel: "Not tied to an invoice",
            icon: <Receipt className="size-6" />,
            tone: "warning",
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
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
                <Wallet className="size-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {deletedView ? "No corrected payments" : "No payments yet"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                {deletedView
                  ? "Corrections show here once a payment has been reversed."
                  : "Record a payment against an invoice or on the customer's account."}
              </p>
            </div>
          ) : (
            <Table className="data-table">
              <TableHeader className="[&_tr]:border-0">
                <TableRow>
                  <TableHead className="h-auto">Date</TableHead>
                  <TableHead className="h-auto">Code</TableHead>
                  <TableHead className="h-auto">Customer</TableHead>
                  <TableHead className="h-auto">Applied to</TableHead>
                  <TableHead className="h-auto">Method</TableHead>
                  <TableHead className="h-auto text-right">Amount</TableHead>
                  <TableHead className="h-auto">Recorded by</TableHead>
                  <TableHead className="h-auto text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className={row.deletedAt ? "opacity-60" : ""}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(row.paidAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary">
                      {row.paymentCode}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/customers/${row.customer.id}/ledger`}
                        className="text-xs font-medium hover:text-primary hover:underline"
                      >
                        {row.customer.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.sale ? (
                        <span className="font-mono text-primary">{row.sale.saleCode}</span>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border">
                          On account
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {row.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {formatMoney(row.amount)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.user?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.deletedAt ? (
                        <span className="text-xs text-muted-foreground">Reversed</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                            title="Download Receipt (PDF)"
                            onClick={() => window.open(`/api/payments/${row.id}/pdf`, "_blank")}
                          >
                            <span className="sr-only">Download receipt</span>
                            <Download className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                            title="Reverse Payment"
                            onClick={() => setConfirmTarget(row)}
                          >
                            <span className="sr-only">Reverse payment</span>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Record payment */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !saving && setDialogOpen(false)}
          />
          <div className="relative bg-background border rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Record payment</h2>
              <p className="text-xs text-muted-foreground">
                Money received against a specific invoice, or on account for later.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-customer">Customer</Label>
              <Select
                value={draft.customerId}
                onValueChange={(v) => setDraft((d) => ({ ...d, customerId: v, saleId: "" }))}
              >
                <SelectTrigger id="payment-customer" className="h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-invoice">Invoice</Label>
              <Select
                value={draft.saleId}
                onValueChange={(v) => setDraft((d) => ({ ...d, saleId: v }))}
                disabled={!draft.customerId}
              >
                <SelectTrigger id="payment-invoice" className="h-9 text-xs rounded-lg">
                  <SelectValue
                    placeholder={
                      draft.customerId
                        ? sales.length === 0
                          ? "No open invoices — will go on account"
                          : "On account (no invoice)"
                        : "Select a customer first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">On account (no invoice)</SelectItem>
                  {sales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.saleCode} — due {formatMoney(s.totalAmount - s.amountPaid)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Amount</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.amount}
                  onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                  className="h-9 text-xs rounded-lg"
                  placeholder="0"
                />
                {overPayment && maxPayment !== null && (
                  <p className="text-xs text-destructive">
                    Balance due is {formatMoney(maxPayment)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Method</Label>
                <Select
                  value={draft.method}
                  onValueChange={(v) =>
                    // SAFETY: this Select renders exactly the METHODS allowlist
                    // above, so `v` is one of those values.
                    setDraft((d) => ({ ...d, method: v as PaymentMethodValue }))
                  }
                >
                  <SelectTrigger id="payment-method" className="h-9 text-xs rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="payment-reference">Reference</Label>
                <Input
                  id="payment-reference"
                  value={draft.reference}
                  onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))}
                  className="h-9 text-xs rounded-lg"
                  placeholder="Cheque no. / transaction id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-date">Paid on</Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={draft.paidAt}
                  onChange={(e) => setDraft((d) => ({ ...d, paidAt: e.target.value }))}
                  className="h-9 text-xs rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-note">Note</Label>
              <Input
                id="payment-note"
                value={draft.note}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                className="h-9 text-xs rounded-lg"
                placeholder="Optional"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
                className="h-9 rounded-md cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreate()}
                disabled={!canSubmit}
                className="h-9 rounded-md shadow-sm cursor-pointer"
              >
                {saving ? "Recording…" : "Record payment"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title={`Reverse payment "${confirmTarget?.paymentCode ?? ""}"?`}
        description={
          confirmTarget?.sale
            ? `The invoice ${confirmTarget.sale.saleCode} becomes unpaid again by ${formatMoney(confirmTarget.amount)} and this row moves to the corrected view.`
            : `This ${formatMoney(confirmTarget?.amount ?? 0)} comes off the customer's account and the row moves to the corrected view.`
        }
        confirmLabel="Reverse payment"
        destructive
        busy={confirmBusy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
