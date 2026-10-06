import { useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ReturnCreateSchema,
  ReturnTypes,
  type ReturnCreateInput,
  type ReturnTypeValue,
} from "@dms/shared";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dms/ui";
import { api } from "../../lib/api";
import { generateReturnCode } from "../../lib/code";
import { formatMoney } from "../../lib/format";

export const RETURN_TYPE_OPTIONS: { value: ReturnTypeValue; label: string }[] = [
  { value: "SALE", label: "Sale Return (Customer handback)" },
  { value: "PURCHASE", label: "Purchase Return (Return to supplier)" },
  { value: "DAMAGED", label: "Damaged Stock (Write-off)" },
  { value: "EXPIRED", label: "Expired Stock (Write-off)" },
];

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export function ReturnForm() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Load products for line items
  const { data: productsData } = useSWR("/products?page=1&pageSize=100", fetcher);
  const products: { id: string; name: string; productCode: string; unitPrice: number; unitCost: number }[] =
    productsData?.data ?? [];

  // Load sales for SALE returns
  const { data: salesData } = useSWR("/sales?page=1&pageSize=100", fetcher);
  const sales: { id: string; saleCode: string; totalAmount: number; customer?: { name: string } }[] =
    salesData?.data ?? [];

  // Load purchases for PURCHASE returns
  const { data: purchasesData } = useSWR("/purchases?page=1&pageSize=100", fetcher);
  const purchases: { id: string; purchaseCode: string; totalAmount: number; supplier?: { companyName: string } }[] =
    purchasesData?.data ?? [];

  const defaultItem = {
    productId: "",
    quantity: 1,
    unitPrice: 0,
    taxAmount: 0,
    discount: 0,
    note: "",
  };

  const form = useForm<any>({
    resolver: zodResolver(ReturnCreateSchema),
    defaultValues: {
      returnCode: generateReturnCode(),
      returnType: "SALE",
      returnDate: new Date().toISOString().split("T")[0],
      reason: "",
      saleId: "",
      purchaseId: "",
      items: [defaultItem],
    },
  });

  const watchedReturnType = form.watch("returnType");
  const watchedItems = form.watch("items") || [];

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const handleProductChange = (index: number, productId: string) => {
    form.setValue(`items.${index}.productId`, productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      const price = watchedReturnType === "PURCHASE" ? prod.unitCost : prod.unitPrice;
      form.setValue(`items.${index}.unitPrice`, price);
    }
  };

  const totalReturnAmount = useMemo(() => {
    return watchedItems.reduce((sum: number, it: any) => {
      const qty = Number(it?.quantity) || 0;
      const price = Number(it?.unitPrice) || 0;
      const tax = Number(it?.taxAmount) || 0;
      const disc = Number(it?.discount) || 0;
      return sum + qty * price + tax - disc;
    }, 0);
  }, [watchedItems]);

  const onSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const payload: any = {
        returnCode: values.returnCode.trim(),
        returnType: values.returnType,
        returnDate: values.returnDate,
        reason: values.reason?.trim() || undefined,
        items: values.items.map((it: any) => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          taxAmount: Number(it.taxAmount) || 0,
          discount: Number(it.discount) || 0,
          note: it.note?.trim() || undefined,
        })),
      };

      if (values.returnType === "SALE") {
        payload.saleId = values.saleId;
      } else if (values.returnType === "PURCHASE") {
        payload.purchaseId = values.purchaseId;
      }

      await api.post("/returns", payload);
      toast.success("Return processed successfully");
      navigate("/returns");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to process return");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Return Header Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Return Code */}
              <FormField
                control={form.control}
                name="returnCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Return Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="RET-YYYY-XXXXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Return Type */}
              <FormField
                control={form.control}
                name="returnType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Return Type *</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        if (val !== "SALE") form.setValue("saleId", "");
                        if (val !== "PURCHASE") form.setValue("purchaseId", "");
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RETURN_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Return Date */}
              <FormField
                control={form.control}
                name="returnDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Return Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conditional Reference: Sale */}
              {watchedReturnType === "SALE" && (
                <FormField
                  control={form.control}
                  name="saleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Original Sale Invoice *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sale invoice" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sales.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.saleCode} ({s.customer?.name || "Customer"}) —{" "}
                              {formatMoney(s.totalAmount)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Conditional Reference: Purchase */}
              {watchedReturnType === "PURCHASE" && (
                <FormField
                  control={form.control}
                  name="purchaseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Original Purchase Order *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select purchase order" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {purchases.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.purchaseCode} ({p.supplier?.companyName || "Supplier"}) —{" "}
                              {formatMoney(p.totalAmount)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Return</FormLabel>
                  <FormControl>
                    <Input placeholder="Describe why this return is being processed..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Return Items Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Return Items</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(defaultItem)}
            >
              <Plus className="size-4 mr-2" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Product *</TableHead>
                    <TableHead className="w-[12%]">Quantity *</TableHead>
                    <TableHead className="w-[15%]">Unit Price *</TableHead>
                    <TableHead className="w-[12%]">Tax Amount</TableHead>
                    <TableHead className="w-[12%]">Discount</TableHead>
                    <TableHead className="w-[15%]">Note</TableHead>
                    <TableHead className="w-[4%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((fieldItem, index) => (
                    <TableRow key={fieldItem.id}>
                      {/* Product */}
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.productId`}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <Select
                                onValueChange={(val) => handleProductChange(index, val)}
                                value={field.value}
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
                        />
                      </TableCell>

                      {/* Quantity */}
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  className="h-9"
                                  {...field}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>

                      {/* Unit Price */}
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.unitPrice`}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="h-9"
                                  {...field}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>

                      {/* Tax Amount */}
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.taxAmount`}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="h-9"
                                  {...field}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>

                      {/* Discount */}
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.discount`}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="h-9"
                                  {...field}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>

                      {/* Note */}
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.note`}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <Input placeholder="Optional note" className="h-9" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>

                      {/* Remove Button */}
                      <TableCell className="text-center">
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end mt-4 text-sm font-semibold">
              <span className="text-muted-foreground mr-2">Estimated Return Value:</span>
              <span className="text-foreground">{formatMoney(totalReturnAmount)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/returns")}
            disabled={submitting}
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Returns
          </Button>

          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            Process Return
          </Button>
        </div>
      </form>
    </Form>
  );
}
