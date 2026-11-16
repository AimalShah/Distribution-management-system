import { useEffect, useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { ArrowLeft, Loader2, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { invalidateDomains } from "../../lib/mutation";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { authClient } from "../../lib/auth-client";
import { useActiveMembership } from "../../lib/profile";
import { formatMoney } from "../../lib/format";
import { LineItemsTable } from "../forms/LineItemsTable";
import { ProductSearchSelect } from "../forms/ProductSearchSelect";

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
  const [creditLimitWarning, setCreditLimitWarning] = useState<{
    outstanding: number;
    limit: number;
    projected: number;
    pendingPayload: any;
  } | null>(null);

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

  const { membership } = useActiveMembership();
  const organizationId = membership?.organizationId ?? "";
  const { data: session } = authClient.useSession?.() ?? { data: null };
  const currentUserId = session?.user?.id ?? (membership as any)?.userId ?? "";

  const { data: membersData } = useSWR(
    organizationId ? `/organizations/${organizationId}/members` : null,
    fetcher
  );

  const salesmen: { id: string; name: string; role?: string }[] = useMemo(() => {
    const list: any[] = Array.isArray(membersData) ? membersData : [];
    return list
      .filter((m) => !m.user?.banned)
      .map((m) => ({
        id: m.user?.id,
        name: m.user?.name || m.user?.email || "Unknown",
        role: m.role,
      }));
  }, [membersData]);

  const { data: orderBookersData } = useSWR(
    "/order-bookers?isActive=true",
    fetcher
  );

  const orderBookers: { id: string; code: string; name: string }[] = useMemo(() => {
    return Array.isArray(orderBookersData)
      ? orderBookersData
      : orderBookersData?.data ?? [];
  }, [orderBookersData]);

  // Prices and stock from two sources: the first page (pre-fetched so common
  // picks fill instantly) and the searched picker, whose results arrive one
  // product at a time — both feed the same "id -> product" map.
  const [extraProducts, setExtraProducts] = useState<Record<string, any>>({});

  const cacheProduct = (product: any) => {
    if (!product?.id) return;

    setExtraProducts((prev) =>
      prev[product.id] ? prev : { ...prev, [product.id]: product }
    );
  };

  const productById = useMemo(() => {
    const map = new Map<string, any>(
      (productsData?.data ?? []).map((product: any) => [product.id, product])
    );

    for (const product of Object.values(extraProducts)) {
      if (!map.has(product.id)) map.set(product.id, product);
    }

    // A document being edited still has to break down and warn on stock even
    // if its products are no longer on the first page or were deleted.
    for (const item of initialData?.items ?? []) {
      if (item.productId && item.product && !map.has(item.product.id)) {
        map.set(item.product.id, item.product);
      }
    }

    return map;
  }, [productsData, extraProducts, initialData]);

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
      saleCode: initialData?.saleCode ?? "",
      saleDate: initialData?.saleDate
        ? new Date(initialData.saleDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      status: initialData?.status ?? "Pending",
      invoiceType: initialData?.invoiceType ?? "regular",
      pricingTier: initialData?.pricingTier ?? "retail",
      salesmanId: initialData?.salesmanId ?? currentUserId,
      orderBookerId: initialData?.orderBookerId ?? null,
      isInterState: initialData?.isInterState ?? false,
      discount: initialData?.discount ?? 0,
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
        pricingTier: initialData.pricingTier ?? "retail",
        salesmanId: initialData.salesmanId ?? currentUserId,
        orderBookerId: initialData.orderBookerId ?? null,
        isInterState: initialData.isInterState ?? false,
        discount: initialData.discount ?? 0,
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
  }, [initialData, form, currentUserId]);

  useEffect(() => {
    if (!form.getValues("salesmanId")) {
      const isSalesman = membership?.role?.toLowerCase() === "salesman";
      if (isSalesman && currentUserId) {
        form.setValue("salesmanId", currentUserId);
      } else if (currentUserId) {
        form.setValue("salesmanId", currentUserId);
      } else if (salesmen.length > 0) {
        form.setValue("salesmanId", salesmen[0].id);
      }
    }
  }, [currentUserId, membership, salesmen, form]);

  const watchedItems = form.watch("items") || [];
  const watchedDiscount = form.watch("discount") || 0;
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
      watchedIsInterState,
      productById,
      isEditing,
    ]);

  const handleProductChange = (index: number, productId: string, product?: any) => {
    form.setValue(`items.${index}.productId`, productId);
    const selectedProd = product ?? productById.get(productId);

    if (selectedProd) {
      const tier = form.getValues("pricingTier") || "retail";
      const tierPrice =
        tier === "wholesale"
          ? (Number(selectedProd.wholesalePrice) || Number(selectedProd.unitPrice) || 0)
          : (Number(selectedProd.retailPrice) || Number(selectedProd.unitPrice) || 0);

      form.setValue(`items.${index}.unitPrice`, tierPrice);

      if (selectedProd.gstApplicable && selectedProd.gstRate) {
        form.setValue(`items.${index}.taxPercent`, Number(selectedProd.gstRate) || 0);
      }
    }
  };

  const handlePricingTierChange = (newTier: "retail" | "wholesale") => {
    form.setValue("pricingTier", newTier);
    const items = form.getValues("items") || [];
    items.forEach((item: any, idx: number) => {
      if (item.productId) {
        const prod = productById.get(item.productId);
        if (prod) {
          const tierPrice =
            newTier === "wholesale"
              ? (Number(prod.wholesalePrice) || Number(prod.unitPrice) || 0)
              : (Number(prod.retailPrice) || Number(prod.unitPrice) || 0);
          form.setValue(`items.${idx}.unitPrice`, tierPrice);
        }
      }
    });
  };

  const onSubmit = async (values: SaleInvoiceInput) => {
    // The module refuses a negative total rather than clamping it; this is the
    // same rule the server applies, shown before anything is sent.
    if (invalidTotal) return;

    setSubmitting(true);
    let createPayload: any = null;

    try {
      if (isEditing && saleId) {
        const updatePayload = {
          customerId: values.customerId,
          saleDate: values.saleDate,
          status: values.status,
          invoiceType: values.invoiceType,
          pricingTier: values.pricingTier,
          salesmanId: values.salesmanId,
          orderBookerId: values.orderBookerId || null,
          isInterState: values.isInterState,
          discount: Number(values.discount) || 0,
        };

        await api.put(`/sales/${saleId}`, updatePayload);
        invalidateDomains("sales");
        toast.success("Sale invoice updated successfully");
      } else {
        createPayload = {
          customerId: values.customerId,
          saleDate: values.saleDate,
          status: values.status,
          invoiceType: values.invoiceType,
          pricingTier: values.pricingTier,
          salesmanId: values.salesmanId,
          orderBookerId: values.orderBookerId || null,
          isInterState: values.isInterState,
          discount: Number(values.discount) || 0,
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
        invalidateDomains("sales");
        toast.success("Sale invoice created successfully");
      }

      navigate("/sales");
    } catch (err: any) {
      const failure = toFailure(err, "Failed to save sale invoice");

      if (failure.code === "CREDIT_LIMIT_EXCEEDED" && failure.details) {
        // SAFETY: The CREDIT_LIMIT_EXCEEDED error details schema carries outstanding, limit, and projected balances.
        const details = failure.details as {
          outstanding: number;
          limit: number;
          projected: number;
        };

        setCreditLimitWarning({
          outstanding: details.outstanding,
          limit: details.limit,
          projected: details.projected,
          pendingPayload: createPayload,
        });

        return;
      }

      // The refusal carries { shortages }: one line per product, in the caller's words.
      const label = (id: string) => productById.get(id)?.name ?? id;

      toast.error(`${failure.message}${shortfallLine(failure, label)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverrideSubmit = async () => {
    if (!creditLimitWarning) return;
    setSubmitting(true);

    try {
      await api.post("/sales", {
        ...creditLimitWarning.pendingPayload,
        overrideCreditLimit: true,
      });
      invalidateDomains("sales");
      toast.success("Sale invoice created with credit limit override");
      setCreditLimitWarning(null);
      navigate("/sales");
    } catch (err: any) {
      const failure = toFailure(err, "Failed to override credit limit");
      toast.error(failure.message);
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
                    <FormLabel>Invoice Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={initialData?.saleCode ?? "Assigned automatically when saved"}
                        readOnly
                        className="font-mono text-xs"
                      />
                    </FormControl>
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
                            <span>
                              Maximum they can owe:{" "}
                              <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                                {formatMoney(selectedCustomer.creditLimit)}
                              </strong>
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400">
                              No maximum set — they can owe any amount
                            </span>
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
                    <FormLabel>Payment status *</FormLabel>
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
                    <p className="text-[11px] text-muted-foreground">
                      Pending: they haven't paid yet · Completed: the deal is done and printed.
                    </p>
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
                name="pricingTier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pricing Tier *</FormLabel>
                    <Select
                      onValueChange={(val: "retail" | "wholesale") => handlePricingTierChange(val)}
                      value={field.value || "retail"}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="Pricing Tier">
                          <SelectValue placeholder="Select pricing tier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="retail">Retail</SelectItem>
                        <SelectItem value="wholesale">Wholesale</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salesmanId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salesman *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="Salesman">
                          <SelectValue placeholder="Select salesman" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {salesmen.length === 0 && field.value ? (
                          <SelectItem value={field.value}>Assigned Salesman</SelectItem>
                        ) : null}
                        {salesmen.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.role ? `(${s.role})` : ""}
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
                name="orderBookerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Booker</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                      value={field.value ?? "none"}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="Order Booker">
                          <SelectValue placeholder="None (Direct Sale)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None (Direct Sale)</SelectItem>
                        {orderBookers.map((b: any) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name} ({b.code})
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
                      <FormLabel className="text-xs">Inter-state supply (charge IGST)</FormLabel>
                      <p className="text-[11px] text-muted-foreground">
                        Untick for sales within the same state (CGST + SGST).
                      </p>
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
                    <FormControl>
                      <ProductSearchSelect
                        value={field.value ?? ""}
                        onChange={(productId, product) => {
                          if (product) cacheProduct(product);
                          handleProductChange(index, productId, product);
                        }}
                        disabled={isEditing}
                        aria-label="Product"
                      />
                    </FormControl>
                    {productById.get(field.value || "")?.inventory &&
                      !isEditing &&
                      qty > (productById.get(field.value).inventory.quantityOnHand ?? 0) && (
                        <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          Only {productById.get(field.value).inventory.quantityOnHand ?? 0} in stock —
                          the server will refuse this line unless stock is added first.
                        </p>
                      )}
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
                      <FormLabel className="text-xs">Discount (whole invoice)</FormLabel>
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

                {/* Display only. The wire contract has no header tax: the API
                    derives the CGST/SGST/IGST split and the tax from the
                    lines' rates, so this box shows the figure the server will
                    store instead of letting a typed number diverge from the
                    stored invoice. */}
                <div className="space-y-2">
                  <span className="text-xs font-medium">Tax (calculated automatically)</span>
                  <Input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    className="h-8 text-xs font-mono bg-muted/40"
                    value={totalTax.toFixed(2)}
                  />
                </div>
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

      {creditLimitWarning && (
        <Dialog open={true} onOpenChange={(open) => !open && setCreditLimitWarning(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="size-5" />
                This customer is going over their maximum
              </DialogTitle>
              <DialogDescription>
                After this sale, their balance due would be {formatMoney(creditLimitWarning.projected)},
                above the maximum of {formatMoney(creditLimitWarning.limit)} set for them. You can
                continue anyway if you accept the debt — owners and admins decide who may.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3 text-sm" data-testid="credit-limit-warning-details">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Balance due now:</span>
                <span className="font-semibold">{formatMoney(creditLimitWarning.outstanding)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Maximum allowed:</span>
                <span className="font-semibold">{formatMoney(creditLimitWarning.limit)}</span>
              </div>
              <div className="flex justify-between text-destructive font-semibold">
                <span>After this sale:</span>
                <span>{formatMoney(creditLimitWarning.projected)}</span>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreditLimitWarning(null)}
                disabled={submitting}
              >
                Don't save yet
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleOverrideSubmit}
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Save anyway"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Form>
  );
}
