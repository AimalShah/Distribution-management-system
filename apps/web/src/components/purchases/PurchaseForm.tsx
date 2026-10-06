import { useEffect, useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { PurchaseFormSchema, type PurchaseFormInput } from "@dms/shared";
import {
  Badge,
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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@dms/ui";
import { api } from "../../lib/api";
import { generateCode } from "../../lib/code";
import { formatMoney } from "../../lib/format";
import { LineItemsTable } from "../forms/LineItemsTable";

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

const fetcher = (url: string) => api.get(url).then((r) => r.data);

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
  const products: { id: string; name: string; productCode: string; unitCost: number; unit: string }[] =
    productsData?.data ?? [];

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
      purchaseCode: initialData?.purchaseCode ?? generateCode("PO"),
      purchaseDate: initialData?.purchaseDate
        ? new Date(initialData.purchaseDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      status: initialData?.status ?? "Pending",
      discount: initialData?.discount ?? 0,
      taxAmount: initialData?.taxAmount ?? 0,
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
        taxAmount: initialData.taxAmount ?? 0,
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
  const watchedTaxAmount = form.watch("taxAmount") || 0;

  // Real-time totals calculation
  const { subtotal, itemsTotal, grandTotal } = useMemo(() => {
    let sub = 0;
    let itemsTot = 0;

    for (const item of watchedItems) {
      const qty = Number(item?.quantity) || 0;
      const cost = Number(item?.unitCost) || 0;
      const gross = qty * cost;
      const itemDisc = Number(item?.itemDiscount) || 0;
      const taxPct = Number(item?.taxPercent) || 0;
      const tax = (taxPct / 100) * Math.max(0, gross - itemDisc);
      const line = Math.max(0, gross - itemDisc + tax);

      sub += gross;
      itemsTot += line;
    }

    const total = Math.max(
      0,
      itemsTot - (Number(watchedDiscount) || 0) + (Number(watchedTaxAmount) || 0)
    );

    return { subtotal: sub, itemsTotal: itemsTot, grandTotal: total };
  }, [watchedItems, watchedDiscount, watchedTaxAmount]);

  const handleProductChange = (index: number, productId: string) => {
    form.setValue(`items.${index}.productId`, productId);
    const selectedProd = products.find((p) => p.id === productId);
    if (selectedProd) {
      form.setValue(`items.${index}.unitCost`, selectedProd.unitCost);
    }
  };

  const onSubmit = async (values: PurchaseFormInput) => {
    setSubmitting(true);
    try {
      if (isEditing && purchaseId) {
        const updatePayload = {
          supplierId: values.supplierId,
          purchaseCode: values.purchaseCode,
          purchaseDate: values.purchaseDate,
          status: values.status,
          discount: Number(values.discount) || 0,
          taxAmount: Number(values.taxAmount) || 0,
        };
        await api.put(`/purchases/${purchaseId}`, updatePayload);
        toast.success("Purchase order updated successfully");
      } else {
        const createPayload = {
          supplierId: values.supplierId,
          purchaseCode: values.purchaseCode,
          purchaseDate: values.purchaseDate,
          status: values.status,
          discount: Number(values.discount) || 0,
          taxAmount: Number(values.taxAmount) || 0,
          items: values.items.map((it) => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            unitCost: Number(it.unitCost),
            batchNumber: it.batchNumber?.trim() || undefined,
            expiryDate: it.expiryDate || undefined,
            taxPercent: Number(it.taxPercent) || 0,
            itemDiscount: Number(it.itemDiscount) || 0,
          })),
        };
        await api.post("/purchases", createPayload);
        toast.success("Purchase order created successfully");
      }
      navigate("/purchases");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to save purchase order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Details Card */}
        <Card>
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
                    <FormLabel>Purchase Order Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="PO-XXXXX" {...field} />
                    </FormControl>
                    <FormMessage />
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
                    <FormLabel>Purchase Date *</FormLabel>
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
          title="Purchase Items"
          subtitle={
            isEditing
              ? "Line items cannot be modified after initial purchase creation."
              : "Add products, quantities, unit costs, and batch details."
          }
          isEditing={isEditing}
          onAdd={() => append(defaultItem)}
          onRemove={(index) => remove(index)}
          columns={[
            { header: "Product *", headClassName: "min-w-[180px]" },
            { header: "Qty *", headClassName: "w-24" },
            { header: "Unit Cost *", headClassName: "w-32" },
            { header: "Batch #", headClassName: "w-28" },
            { header: "Expiry Date", headClassName: "w-36" },
            { header: "Tax %", headClassName: "w-24" },
            { header: "Discount", headClassName: "w-28" },
            {
              header: "Line Total",
              headClassName: "w-28 text-right",
              cellClassName: "text-right font-medium",
            },
          ]}
          rowKeys={fields.map((fieldItem) => fieldItem.id)}
          renderRow={(index) => {
            const itemValues = watchedItems[index] || {};
            const qty = Number(itemValues.quantity) || 0;
            const cost = Number(itemValues.unitCost) || 0;
            const gross = qty * cost;
            const itmDisc = Number(itemValues.itemDiscount) || 0;
            const tax =
              ((Number(itemValues.taxPercent) || 0) / 100) *
              Math.max(0, gross - itmDisc);
            const lineTotal = Math.max(0, gross - itmDisc + tax);

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

              // Batch Number
              <FormField
                control={form.control}
                name={`items.${index}.batchNumber`}
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <Input
                        placeholder="Batch"
                        className="h-9"
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
                        className="h-9"
                        disabled={isEditing}
                        {...field}
                      />
                    </FormControl>
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

              // Item Discount
              <FormField
                control={form.control}
                name={`items.${index}.itemDiscount`}
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
          <Card>
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
                      <FormLabel>Order Discount</FormLabel>
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

                <FormField
                  control={form.control}
                  name="taxAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Tax</FormLabel>
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
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items Subtotal:</span>
                <span className="font-medium">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items Total (with tax & line discount):</span>
                <span className="font-medium">{formatMoney(itemsTotal)}</span>
              </div>
              {Number(watchedDiscount) > 0 && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Order Discount:</span>
                  <span>-{formatMoney(Number(watchedDiscount))}</span>
                </div>
              )}
              {Number(watchedTaxAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Tax:</span>
                  <span>+{formatMoney(Number(watchedTaxAmount))}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-bold">
                <span>Grand Total:</span>
                <span className="text-primary">{formatMoney(grandTotal)}</span>
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
