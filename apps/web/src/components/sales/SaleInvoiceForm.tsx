import { useEffect, useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  calculateSaleBreakdown,
  isInvalidSaleTotal,
  SaleInvoiceSchema,
  type SaleInvoiceInput,
} from "@dms/shared";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@dms/ui";
import { api, fetcher, shortfallLine, toFailure } from "../../lib/api";
import { generateSaleInvoiceCode } from "../../lib/code";
import { formatMoney } from "../../lib/format";
import { LineItemsTable } from "../forms/LineItemsTable";

export const SALE_STATUS_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

export interface SaleInvoiceFormProps {
  saleId?: string;
  initialData?: any;
  isEditing?: boolean;
}

export function SaleInvoiceForm({
  saleId,
  initialData,
  isEditing = false,
}: SaleInvoiceFormProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Fetch customers and products for dropdowns
  const { data: customersData } = useSWR("/customers?page=1&pageSize=100", fetcher);
  const customers: {
    id: string;
    name: string;
    creditLimit?: number | null;
    customerCode?: string;
    phone?: string | null;
  }[] = customersData?.data ?? [];

  const { data: productsData } = useSWR("/products?page=1&pageSize=100", fetcher);

  const products: {
    id: string;
    name: string;
    productCode: string;
    unitPrice: number;
    unit: string;
    gstApplicable: boolean;
    gstRate: number;
  }[] = productsData?.data ?? [];

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const defaultItem = {
    productId: "",
    quantity: 1,
    unitPrice: 0,
    taxPercent: 0,
  };

  const form = useForm<any>({
    resolver: zodResolver(SaleInvoiceSchema),
    defaultValues: {
      customerId: initialData?.customerId ?? "",
      saleCode: initialData?.saleCode ?? generateSaleInvoiceCode(),
      saleDate: initialData?.saleDate
        ? new Date(initialData.saleDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      status: initialData?.status ?? "Pending",
      invoiceType: initialData?.invoiceType ?? "regular",
      isInterState: initialData?.isInterState ?? false,
      discount: initialData?.discount ?? 0,
      taxAmount: initialData?.taxAmount ?? 0,
      items: initialData?.items?.length
        ? initialData.items.map((it: any) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            taxPercent: it.taxPercent ?? 0,
          }))
        : [defaultItem],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Re-populate if initialData loads asynchronously
  useEffect(() => {
    if (initialData) {
      form.reset({
        customerId: initialData.customerId ?? "",
        saleCode: initialData.saleCode ?? "",
        saleDate: initialData.saleDate
          ? new Date(initialData.saleDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        status: initialData.status ?? "Pending",
        invoiceType: initialData.invoiceType ?? "regular",
        isInterState: initialData.isInterState ?? false,
        discount: initialData.discount ?? 0,
        taxAmount: initialData.taxAmount ?? 0,
        items: initialData.items?.length
          ? initialData.items.map((it: any) => ({
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              taxPercent: it.taxPercent ?? 0,
            }))
          : [defaultItem],
      });
    }
  }, [initialData, form]);

  const watchedItems = form.watch("items") || [];
  const watchedDiscount = form.watch("discount") || 0;
  const watchedTaxAmount = form.watch("taxAmount") || 0;
  const watchedInvoiceType = form.watch("invoiceType") || "regular";
  const watchedIsInterState = form.watch("isInterState") || false;

  // The summary is one call into the module that owns the document's money
  // figures, with exactly the inputs the payload will send — rates, split,
  // rounding, and the invalid-total rule included — so the preview agrees with
  // what POST /sales stores instead of holding its own copy of the arithmetic.
  const { subtotal, grandTotal, cgstTotal, sgstTotal, igstTotal, totalTax, invalidTotal } =
    useMemo(() => {
      const breakdown = calculateSaleBreakdown({
        items: watchedItems.map((item: any) => {
          const product = productById.get(item?.productId ?? "");
          const typedRate = Number(item?.taxPercent);

          // Creating treats a blank or zero box as "no line rate stated", so the
          // product's rate applies — the same fallback the write path makes.
          // Editing shows the stored record as it stands, and nothing is
          // re-derived from a product the document may no longer be tied to.
          return {
            productId: item?.productId ?? "",
            quantity: Number(item?.quantity) || 0,
            unitPrice: Number(item?.unitPrice) || 0,
            taxPercent: isEditing
              ? Number(item?.taxPercent) || 0
              : typedRate > 0
                ? typedRate
                : undefined,
            gstApplicable: product?.gstApplicable,
            gstRate: product?.gstRate,
          };
        }),
        isInterState: watchedIsInterState,
        discount: Number(watchedDiscount) || 0,
        taxAmount: Number(watchedTaxAmount) > 0 ? Number(watchedTaxAmount) : undefined,
      });

      return {
        subtotal: breakdown.subtotal,
        grandTotal: breakdown.total,
        cgstTotal: breakdown.cgstAmount,
        sgstTotal: breakdown.sgstAmount,
        igstTotal: breakdown.igstAmount,
        totalTax: breakdown.taxAmount,
        invalidTotal: isInvalidSaleTotal(breakdown.total),
      };
    }, [
      watchedItems,
      watchedDiscount,
      watchedTaxAmount,
      watchedIsInterState,
      productById,
      isEditing,
    ]);

  const handleProductChange = (index: number, productId: string) => {
    form.setValue(`items.${index}.productId`, productId);
    const selectedProd = products.find((p) => p.id === productId);

    if (selectedProd) {
      form.setValue(`items.${index}.unitPrice`, selectedProd.unitPrice);
    }
  };

  const onSubmit = async (values: SaleInvoiceInput) => {
    // The module refuses a negative total rather than clamping it; this is the
    // same rule the server applies, shown before anything is sent.
    if (invalidTotal) return;

    setSubmitting(true);

    try {
      if (isEditing && saleId) {
        const updatePayload = {
          customerId: values.customerId,
          saleCode: values.saleCode,
          saleDate: values.saleDate,
          status: values.status,
          invoiceType: values.invoiceType,
          isInterState: values.isInterState,
          discount: Number(values.discount) || 0,
          // Absent means "leave the column alone"; a stated figure overwrites.
          taxAmount: Number(values.taxAmount) > 0 ? Number(values.taxAmount) : undefined,
        };

        await api.put(`/sales/${saleId}`, updatePayload);
        toast.success("Sale invoice updated successfully");
      } else {
        const createPayload = {
          customerId: values.customerId,
          saleCode: values.saleCode,
          saleDate: values.saleDate,
          status: values.status,
          invoiceType: values.invoiceType,
          isInterState: values.isInterState,
          discount: Number(values.discount) || 0,
          // A box at zero means "no opinion": the write path derives the tax
          // from the lines' rates. A figure above zero states it outright.
          taxAmount: Number(values.taxAmount) > 0 ? Number(values.taxAmount) : undefined,
          items: values.items.map((it) => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            // Zero means "the product's rate applies", the same fallback the
            // preview above just made — absent, not zero, on the wire.
            taxPercent: Number(it.taxPercent) > 0 ? Number(it.taxPercent) : undefined,
          })),
        };

        await api.post("/sales", createPayload);
        toast.success("Sale invoice created successfully");
      }

      navigate("/sales");
    } catch (err: any) {
      // The refusal carries { shortages }: one line per product, in the caller's words.
      const failure = toFailure(err, "Failed to save sale invoice");
      const label = (id: string) => products.find((p) => p.id === id)?.name ?? id;

      toast.error(`${failure.message}${shortfallLine(failure, label)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Details Card */}
        <Card className="rounded-md border border-border shadow-none">
          <CardHeader className="p-4 sm:px-6 sm:py-3 border-b border-border bg-muted/10">
            <CardTitle className="text-base font-semibold">{isEditing ? "Edit Sale Invoice" : "Sale Invoice Details"}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <FormField
                control={form.control}
                name="saleCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="SALE-2026-XXXXX" className="font-mono text-xs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => {
                  const selectedCustomer = customers.find((c) => c.id === field.value);

                  return (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Customer *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} {c.customerCode ? `(${c.customerCode})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedCustomer && (
                        <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                          <span>Code: <strong className="font-mono text-foreground">{selectedCustomer.customerCode}</strong></span>
                          {selectedCustomer.creditLimit ? (
                            <span>Credit Limit: <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">{formatMoney(selectedCustomer.creditLimit)}</strong></span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400">Cash terms / No credit limit</span>
                          )}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="saleDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SALE_STATUS_OPTIONS.map((st) => (
                          <SelectItem key={st.value} value={st.value}>
                            {st.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoiceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="regular">Regular Invoice</SelectItem>
                        <SelectItem value="tax">Tax Invoice</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isInterState"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 mt-6">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-xs">Inter-State (IGST)</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <LineItemsTable
          title="Invoice Line Items"
          subtitle={
            isEditing
              ? "Line items cannot be modified after initial invoice creation."
              : "Add products, quantities, prices, and tax rates."
          }
          isEditing={isEditing}
          onAdd={() => append(defaultItem)}
          onRemove={(index) => remove(index)}
          columns={[
            { header: "Product *", headClassName: "min-w-[220px]" },
            { header: "Quantity *", headClassName: "w-28" },
            { header: "Unit Price *", headClassName: "w-36" },
            { header: "Tax %", headClassName: "w-28" },
            {
              header: "Line Total",
              headClassName: "w-32 text-right",
              cellClassName: "text-right font-medium",
            },
          ]}
          rowKeys={fields.map((fieldItem) => fieldItem.id)}
          renderRow={(index) => {
            const itemValues = watchedItems[index] || {};
            const qty = Number(itemValues.quantity) || 0;
            const price = Number(itemValues.unitPrice) || 0;
            const lineTotal = qty * price;

            return [
              // Product
              <FormField
                control={form.control}
                name={`items.${index}.productId`}
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <Select
                      onValueChange={(val) => handleProductChange(index, val)}
                      value={field.value}
                      disabled={isEditing}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.productCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />,

              // Quantity
              <FormField
                control={form.control}
                name={`items.${index}.quantity`}
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        className="h-9"
                        disabled={isEditing}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />,

              // Unit Price
              <FormField
                control={form.control}
                name={`items.${index}.unitPrice`}
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-9"
                        disabled={isEditing}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />,

              // Tax %
              <FormField
                control={form.control}
                name={`items.${index}.taxPercent`}
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        className="h-9"
                        disabled={isEditing}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />,

              // Line Total
              formatMoney(lineTotal),
            ];
          }}
        />

        {/* Adjustments & Totals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-md border border-border shadow-none">
            <CardHeader className="p-3 sm:px-4 sm:py-3 border-b border-border bg-muted/10">
              <CardTitle className="text-sm font-semibold">Adjustments</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Invoice Discount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 text-xs font-mono"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Invoice Tax (Override)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 text-xs font-mono"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-md border border-border shadow-none">
            <CardHeader className="p-3 sm:px-4 sm:py-3 border-b border-border bg-muted/10">
              <CardTitle className="text-sm font-semibold">Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Invoice Type</span>
                <span className="font-medium capitalize">{watchedInvoiceType === "tax" ? "Tax Invoice" : "Regular Invoice"}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Items Subtotal</span>
                <span className="font-medium tabular-nums">{formatMoney(subtotal)}</span>
              </div>
              {Number(watchedDiscount) > 0 && (
                <div className="flex justify-between text-xs sm:text-sm text-emerald-700 dark:text-emerald-400">
                  <span>Discount</span>
                  <span className="tabular-nums">-{formatMoney(Number(watchedDiscount))}</span>
                </div>
              )}
              {cgstTotal > 0 && (
                <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
                  <span>CGST</span>
                  <span className="tabular-nums">+{formatMoney(cgstTotal)}</span>
                </div>
              )}
              {sgstTotal > 0 && (
                <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
                  <span>SGST</span>
                  <span className="tabular-nums">+{formatMoney(sgstTotal)}</span>
                </div>
              )}
              {igstTotal > 0 && (
                <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
                  <span>IGST</span>
                  <span className="tabular-nums">+{formatMoney(igstTotal)}</span>
                </div>
              )}
              {totalTax > 0 && (
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Total Tax</span>
                  <span className="tabular-nums">+{formatMoney(totalTax)}</span>
                </div>
              )}
              <Separator className="my-1.5" />
              <div className="flex justify-between text-sm sm:text-base font-semibold">
                <span>Grand Total</span>
                <span className="text-foreground tabular-nums text-lg">{formatMoney(grandTotal)}</span>
              </div>
              {invalidTotal && (
                <p className="text-sm font-medium text-destructive">
                  Sale total cannot be negative. Check the discount and tax amounts.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/sales")}
            disabled={submitting}
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Sales
          </Button>

          <Button type="submit" disabled={submitting || invalidTotal}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            {isEditing ? "Update Sale Invoice" : "Create Sale Invoice"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
