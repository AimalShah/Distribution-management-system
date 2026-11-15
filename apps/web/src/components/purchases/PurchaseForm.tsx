import { useEffect, useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { invalidateDomains } from "../../lib/mutation";
import { PurchaseFormSchema, type PurchaseFormInput } from "@dms/shared";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { api, failureMessage, fetcher } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import { LineItemsTable } from "../forms/LineItemsTable";
import { ProductSearchSelect } from "../forms/ProductSearchSelect";

export const PURCHASE_STATUS_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Received", label: "Received" },
  { value: "Cancelled", label: "Cancelled" },
];

export interface PurchaseFormProps {
  purchaseId?: string;
  initialData?: any;
  isEditing?: boolean;
}

export function PurchaseForm({
  purchaseId,
  initialData,
  isEditing = false,
}: PurchaseFormProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Fetch suppliers and products for dropdowns
  const { data: suppliersData } = useSWR("/suppliers?page=1&pageSize=100", fetcher);
  const suppliers: { id: string; companyName: string }[] = suppliersData?.data ?? [];

  const { data: productsData } = useSWR("/products?page=1&pageSize=100", fetcher);

  // Prices and details from two sources: the first page (pre-fetched so common
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

    for (const item of initialData?.purchaseItems ?? []) {
      if (item.productId && item.product && !map.has(item.product.id)) {
        map.set(item.product.id, item.product);
      }
    }

    return map;
  }, [productsData, extraProducts, initialData]);

  const defaultItem = {
    productId: "",
    quantity: 1,
    unitCost: 0,
    batchNumber: "",
    expiryDate: "",
    taxPercent: 0,
    itemDiscount: 0,
  };

  const form = useForm<any>({
    resolver: zodResolver(PurchaseFormSchema),
    defaultValues: {
      supplierId: initialData?.supplierId ?? "",
      purchaseCode: initialData?.purchaseCode ?? "",
      purchaseDate: initialData?.purchaseDate
        ? new Date(initialData.purchaseDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      status: initialData?.status ?? "Pending",
      discount: initialData?.discount ?? 0,
      items: initialData?.purchaseItems?.length
        ? initialData.purchaseItems.map((pi: any) => ({
            productId: pi.productId,
            quantity: pi.quantity,
            unitCost: pi.unitCost,
            batchNumber: pi.batchNumber ?? "",
            expiryDate: pi.expiryDate
              ? new Date(pi.expiryDate).toISOString().split("T")[0]
              : "",
            taxPercent: pi.taxPercent ?? 0,
            itemDiscount: pi.discount ?? 0,
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
        supplierId: initialData.supplierId ?? "",
        purchaseCode: initialData.purchaseCode ?? "",
        purchaseDate: initialData.purchaseDate
          ? new Date(initialData.purchaseDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        status: initialData.status ?? "Pending",
        discount: initialData.discount ?? 0,
        items: initialData.purchaseItems?.length
          ? initialData.purchaseItems.map((pi: any) => ({
              productId: pi.productId,
              quantity: pi.quantity,
              unitCost: pi.unitCost,
              batchNumber: pi.batchNumber ?? "",
              expiryDate: pi.expiryDate
                ? new Date(pi.expiryDate).toISOString().split("T")[0]
                : "",
              taxPercent: pi.taxPercent ?? 0,
              itemDiscount: pi.discount ?? 0,
            }))
          : [defaultItem],
      });
    }
  }, [initialData, form]);

  const watchedItems = form.watch("items") || [];
  const watchedDiscount = form.watch("discount") || 0;

  // Real-time totals calculation
  const { subtotal, grandTotal, orderTax } = useMemo(() => {
    let sub = 0;
    let tax = 0;

    for (const item of watchedItems) {
      const qty = Number(item?.quantity) || 0;
      const cost = Number(item?.unitCost) || 0;
      const gross = qty * cost;
      const taxPct = Number(item?.taxPercent) || 0;
      const lineTax = (taxPct / 100) * gross;

      sub += gross;
      tax += lineTax;
    }

    // No header tax input exists: the API derives the order's tax from the
    // lines' rates (`linesTax` server-side), so the preview calculates and
    // displays exactly that figure.
    const total = Math.max(0, sub + tax - (Number(watchedDiscount) || 0));

    return { subtotal: sub, grandTotal: total, orderTax: tax };
  }, [watchedItems, watchedDiscount]);

  const handleProductChange = (index: number, productId: string, product?: any) => {
    form.setValue(`items.${index}.productId`, productId);
    const selectedProd = product ?? productById.get(productId);

    if (selectedProd) {
      form.setValue(`items.${index}.unitCost`, Number(selectedProd.unitCost) || 0);
      form.setValue(
        `items.${index}.taxPercent`,
        selectedProd.gstApplicable ? (Number(selectedProd.gstRate) || 0) : 0
      );
    }
  };

  const onSubmit = async (values: PurchaseFormInput) => {
    setSubmitting(true);

    try {
      if (isEditing && purchaseId) {
        const updatePayload = {
          supplierId: values.supplierId,
          purchaseDate: values.purchaseDate,
          status: values.status,
          discount: Number(values.discount) || 0,
        };

        await api.put(`/purchases/${purchaseId}`, updatePayload);
        invalidateDomains("purchases");
        toast.success("Purchase order updated successfully");
      } else {
        const createPayload = {
          supplierId: values.supplierId,
          purchaseDate: values.purchaseDate,
          status: values.status,
          discount: Number(values.discount) || 0,
          items: values.items.map((it: any) => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            unitCost: Number(it.unitCost),
            batchNumber: it.batchNumber?.trim() || undefined,
            expiryDate: it.expiryDate || undefined,
            taxPercent: Number(it.taxPercent) || 0,
            itemDiscount: 0,
          })),
        };

        await api.post("/purchases", createPayload);
        invalidateDomains("purchases");
        toast.success("Purchase order created successfully");
      }

      navigate("/purchases");
    } catch (err: any) {
      toast.error(failureMessage(err, "Failed to save purchase order"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Details Card */}
        <Card className="rounded-md border border-border shadow-none">
          <CardHeader>
            <CardTitle>{isEditing ? "Edit Purchase Order" : "Purchase Order Details"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="purchaseCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={initialData?.purchaseCode ?? "Assigned automatically when saved"}
                        readOnly
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.companyName}
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
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase date *</FormLabel>
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
                    <FormLabel>Order status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PURCHASE_STATUS_OPTIONS.map((st) => (
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
            </div>
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <LineItemsTable
          title="Products purchased"
          subtitle={
            isEditing
              ? "Line items cannot be modified after initial purchase creation."
              : "Add products, quantities, costs, and batch details."
          }
          isEditing={isEditing}
          onAdd={() => append(defaultItem)}
          onRemove={(index) => remove(index)}
          columns={[
            { header: "Product *", headClassName: "min-w-[220px]" },
            { header: "Quantity *", headClassName: "w-24" },
            { header: "Cost per unit *", headClassName: "w-32" },
            { header: "Batch #", headClassName: "w-28" },
            { header: "Expiry date", headClassName: "w-36" },
            {
              header: "Line total",
              headClassName: "w-32 text-right",
              cellClassName: "text-right font-medium",
            },
          ]}
          rowKeys={fields.map((fieldItem) => fieldItem.id)}
          renderRow={(index) => {
            const itemValues = watchedItems[index] || {};
            const qty = Number(itemValues.quantity) || 0;
            const cost = Number(itemValues.unitCost) || 0;
            const lineTotal = qty * cost;

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
                        priceMode="purchase"
                      />
                    </FormControl>
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

              // Unit Cost
              <FormField
                control={form.control}
                name={`items.${index}.unitCost`}
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-9 font-mono"
                        disabled={isEditing}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />,

              // Batch Number
              <FormField
                control={form.control}
                name={`items.${index}.batchNumber`}
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <Input
                        placeholder="Batch #"
                        className="h-9 font-mono text-xs"
                        disabled={isEditing}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />,

              // Expiry Date
              <FormField
                control={form.control}
                name={`items.${index}.expiryDate`}
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <Input
                        type="date"
                        className="h-9 text-xs"
                        disabled={isEditing}
                        {...field}
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

        {/* Totals & Discounts Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-md border border-border shadow-none">
            <CardHeader>
              <CardTitle>Adjustments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount (whole order)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Display only. The wire contract has no header tax: the API
                    derives the order's tax from the lines' rates, so this box
                    shows the figure the server will store instead of letting a
                    typed number diverge from the stored purchase. */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Tax (calculated automatically)
                  </label>
                  <Input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    className="bg-muted/40 font-mono"
                    value={orderTax.toFixed(2)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-md border border-border shadow-none">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items subtotal:</span>
                <span className="font-medium font-mono tabular-nums">{formatMoney(subtotal)}</span>
              </div>
              {orderTax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order tax:</span>
                  <span className="font-mono tabular-nums">+{formatMoney(orderTax)}</span>
                </div>
              )}
              {Number(watchedDiscount) > 0 && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Order discount:</span>
                  <span className="font-mono tabular-nums">-{formatMoney(Number(watchedDiscount))}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-bold">
                <span>Grand total:</span>
                <span className="text-primary font-mono tabular-nums">{formatMoney(grandTotal)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/purchases")}
            disabled={submitting}
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Purchases
          </Button>

          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            {isEditing ? "Update Purchase Order" : "Create Purchase Order"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
