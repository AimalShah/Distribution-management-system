import { useState, useEffect } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dms/ui";
import { PaymentMethods, type PaymentMethodValue } from "@dms/shared";
import { api, failureMessage, fetcher } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import { generateCode } from "../../lib/code";

const METHODS = PaymentMethods;

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

export interface QuickPayTarget {
  id: string;
  saleCode: string;
  customerId: string;
  customerName?: string;
  totalAmount: number;
  amountPaid: number;
}

interface RecordPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultSale?: QuickPayTarget | null;
}

export function RecordPaymentDialog({
  open,
  onClose,
  onSuccess,
  defaultSale,
}: RecordPaymentDialogProps) {
  const [customerId, setCustomerId] = useState("");
  const [saleId, setSaleId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethodValue>("Cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync draft when defaultSale changes or dialog opens
  useEffect(() => {
    if (open) {
      if (defaultSale) {
        setCustomerId(defaultSale.customerId);
        setSaleId(defaultSale.id);
        const remaining = Math.max(0, defaultSale.totalAmount - (defaultSale.amountPaid ?? 0));
        setAmount(remaining > 0 ? String(remaining) : "");
      } else {
        setCustomerId("");
        setSaleId("");
        setAmount("");
      }
      setMethod("Cash");
      setReference("");
      setNote("");
      setPaidAt(new Date().toISOString().slice(0, 10));
    }
  }, [open, defaultSale]);

  const { data: customerData } = useSWR(
    open ? "/customers?pageSize=100" : null,
    fetcher
  );

  const { data: saleData } = useSWR(
    open && customerId ? `/sales/customer/${customerId}?pageSize=100` : null,
    fetcher
  );

  const customers = ((customerData?.data ?? []) as CustomerOption[]).filter((c) => c.isActive);
  const sales = ((saleData?.data ?? []) as SaleOption[]).filter(
    (s) => s.id === defaultSale?.id || s.amountPaid < s.totalAmount
  );

  const selectedSale = sales.find((s) => s.id === saleId) ?? (defaultSale?.id === saleId ? defaultSale : null);

  const amountNumber = Number(amount);
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const maxPayment = selectedSale ? selectedSale.totalAmount - selectedSale.amountPaid : null;
  const overPayment = maxPayment !== null && amountValid && amountNumber > maxPayment;

  const canSubmit = customerId !== "" && amountValid && !overPayment && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);

    try {
      const payload: any = {
        paymentCode: generateCode("PMT"),
        customerId,
        amount: amountNumber,
        method,
      };

      if (saleId) payload.saleId = saleId;
      if (reference.trim()) payload.reference = reference.trim();
      if (note.trim()) payload.note = note.trim();
      if (paidAt) payload.paidAt = new Date(paidAt).toISOString();

      await api.post("/payments", payload);
      toast.success("Payment recorded successfully");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(failureMessage(err, "Failed to record payment"));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
        onClick={() => !saving && onClose()}
      />
      <div className="relative bg-background border rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Record Payment</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {defaultSale
              ? `Recording payment against invoice ${defaultSale.saleCode}`
              : "Money received against a specific invoice, or on customer account."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pay-customer">Customer</Label>
          <Select
            value={customerId}
            onValueChange={(v) => {
              setCustomerId(v);
              setSaleId("");
            }}
            disabled={!!defaultSale}
          >
            <SelectTrigger id="pay-customer" className="h-9 text-xs rounded-lg">
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
          <Label htmlFor="pay-invoice">Invoice</Label>
          <Select
            value={saleId}
            onValueChange={(v) => {
              setSaleId(v);
              const sale = sales.find((s) => s.id === v);
              if (sale) {
                const rem = Math.max(0, sale.totalAmount - sale.amountPaid);
                setAmount(rem > 0 ? String(rem) : "");
              }
            }}
            disabled={!customerId || !!defaultSale}
          >
            <SelectTrigger id="pay-invoice" className="h-9 text-xs rounded-lg">
              <SelectValue
                placeholder={
                  customerId
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
            <Label htmlFor="pay-amount">Amount</Label>
            <Input
              id="pay-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
            <Label htmlFor="pay-method">Method</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethodValue)}
            >
              <SelectTrigger id="pay-method" className="h-9 text-xs rounded-lg">
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
            <Label htmlFor="pay-ref">Reference</Label>
            <Input
              id="pay-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-9 text-xs rounded-lg"
              placeholder="Cheque / transaction ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-date">Paid on</Label>
            <Input
              id="pay-date"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="h-9 text-xs rounded-lg"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pay-note">Note</Label>
          <Input
            id="pay-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-9 text-xs rounded-lg"
            placeholder="Optional notes"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="h-9 text-xs rounded-md cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="h-9 text-xs rounded-md shadow-sm cursor-pointer"
          >
            {saving ? "Recording…" : "Record Payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
