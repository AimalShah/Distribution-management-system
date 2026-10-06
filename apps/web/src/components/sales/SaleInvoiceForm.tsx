import { useEffect, useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { SaleInvoiceSchema, type SaleInvoiceInput } from "@dms/shared";
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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@dms/ui";
import { api } from "../../lib/api";
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

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export function SaleInvoiceForm({
  saleId,
  initialData,
  isEditing = false,
}: SaleInvoiceFormProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Fetch customers and products for dropdowns
  const { data: customersData } = useSWR("/customers?page=1&pageSize=100", fetcher);
  const customers: { id: string; name: string }[] = customersData?.data ?? [];

  const { data: productsData } = useSWR("/products?page=1&pageSize=100", fetcher);
  const products: { id: string; name: string; productCode: string; unitPrice: number; unit: string }[] =
    productsData?.data ?? [];

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

  // Real-time totals matching backend formula
  const { subtotal, grandTotal } = useMemo(() => {
    let sub = 0;
    for (const item of watchedItems) {
      const qty = Number(item?.quantity) || 0;
      const price = Number(item?.unitPrice) || 0;
      sub += qty * price;
    }

    const total = Math.max(
      0,
      sub + (Number(watchedTaxAmount) || 0) - (Number(watchedDiscount) || 0)
    );

    return { subtotal: sub, grandTotal: total };
  }, [watchedItems, watchedDiscount, watchedTaxAmount]);

  const handleProductChange = (index: number, productId: string) => {
    form.setValue(`items.${index}.productId`, productId);
    const selectedProd = products.find((p) => p.id === productId);
    if (selectedProd) {
      form.setValue(`items.${index}.unitPrice`, selectedProd.unitPrice);
    }
  };

  const onSubmit = async (values: SaleInvoiceInput) => {
    setSubmitting(true);
    try {
      if (isEditing && saleId) {
        const updatePayload = {
          customerId: values.customerId,
          saleCode: values.saleCode,
          saleDate: values.saleDate,
          status: values.status,
          discount: Number(values.discount) || 0,
          taxAmount: Number(values.taxAmount) || 0,
        };
        await api.put(`/sales/${saleId}`, updatePayload);
        toast.success("Sale invoice updated successfully");
      } else {
        const createPayload = {
          customerId: values.customerId,
          saleCode: values.saleCode,
          saleDate: values.saleDate,
          status: values.status,
          discount: Number(values.discount) || 0,
          taxAmount: Number(values.taxAmount) || 0,
          items: values.items.map((it) => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            taxPercent: Number(it.taxPercent) || 0,
          })),
        };
        await api.post("/sales", createPayload);
        toast.success("Sale invoice created successfully");
      }
      navigate("/sales");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to save sale invoice");
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
            <CardTitle>{isEditing ? "Edit Sale Invoice" : "Sale Invoice Details"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="saleCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="SALE-2026-XXXXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
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
                            {c.name}
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
                      <FormLabel>Invoice Discount</FormLabel>
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
                      <FormLabel>Invoice Tax</FormLabel>
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
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items Subtotal:</span>
                <span className="font-medium">{formatMoney(subtotal)}</span>
              </div>
              {Number(watchedDiscount) > 0 && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Discount:</span>
                  <span>-{formatMoney(Number(watchedDiscount))}</span>
                </div>
              )}
              {Number(watchedTaxAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax Amount:</span>
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
            onClick={() => navigate("/sales")}
            disabled={submitting}
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Sales
          </Button>

          <Button type="submit" disabled={submitting}>
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
