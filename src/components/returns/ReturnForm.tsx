"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, AlertCircle, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ReturnType } from "@/types/return";
import type { ReturnFormData } from "@/types/return";
import { format } from "date-fns";
import { createReturn } from "@/actions/return";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { getSalesInvoicesByCustomer } from "@/actions/saleInvoice";
import type { fetchCustomers } from "@/actions/customer";
import type { fetchProducts } from "@/actions/product";
import type { fetchPurchases } from "@/actions/purchase";
import { useState, useEffect } from "react";
import { ReturnFormSchema } from "@/validations/schemas";
import type { ReturnFormInput, ReturnFormOutput } from "@/validations/schemas";

/**
 * The type an async action resolves to. Spelled out instead of using the
 * global `ReturnType<T>` utility, which the imported `ReturnType` value
 * shadows for the whole file.
 */
type Resolved<TFn extends (...args: never[]) => unknown> = TFn extends (
  ...args: never[]
) => infer R
  ? Awaited<R>
  : never;

/**
 * The server-fetch actions resolve to `{ success, data }` unions, so these props
 * are the `data` lists rather than single records. Deriving them from the
 * actions keeps them in step with the Prisma includes instead of restating the
 * record shapes here.
 */
type FetchedList<T> = T extends { data: infer D } ? D : never;

type ProductList = FetchedList<Resolved<typeof fetchProducts>>;
type CustomerList = FetchedList<Resolved<typeof fetchCustomers>>;
type PurchaseList = FetchedList<Resolved<typeof fetchPurchases>>;
type SalesInvoiceList = Resolved<typeof getSalesInvoicesByCustomer>;

const returnTypeOptions = [
  {
    value: "SALE",
    label: "Sale Return",
    icon: RotateCcw,
    color: "bg-blue-500",
  },
  {
    value: "PURCHASE",
    label: "Purchase Return",
    icon: RotateCcw,
    color: "bg-green-500",
  },
  {
    value: "EXPIRED",
    label: "Expired Product",
    icon: AlertCircle,
    color: "bg-orange-500",
  },
  {
    value: "DAMAGED",
    label: "Damaged Product",
    icon: Package,
    color: "bg-red-500",
  },
];

export default function ReturnForm({
  products,
  customers,
  purchases,
}: {
  products?: ProductList;
  customers?: CustomerList;
  purchases?: PurchaseList;
}) {
  const router = useRouter();
  const [sales, setSales] = useState<SalesInvoiceList>([]);
  const [salesLoading, setSalesLoading] = useState(false);

  const form = useForm<ReturnFormInput, unknown, ReturnFormOutput>({
    resolver: zodResolver(ReturnFormSchema),
    defaultValues: {
      returnCode: `RET-${Date.now().toString().slice(-6)}`,
      returnDate: new Date().toISOString().split("T")[0],
      customerId: "",
      saleId: "",
      purchaseId: "",
      returnType: ReturnType.SALE,
      reason: "",
      items: [
        {
          productId: "",
          quantity: 1,
          unitPrice: 0,
          taxAmount: 0,
          discount: 0,
          note: "",
        },
      ],
    },
  });

  const customerId = form.watch("customerId");
  const returnType = form.watch("returnType");

  const handleSaleInvoiceByCustomer = async (customerId: string) => {
    if (!customerId) {
      setSales([]);
      return;
    }

    try {
      setSalesLoading(true);
      const saleInvoices = await getSalesInvoicesByCustomer(customerId);
      setSales(saleInvoices || []);
    } catch (error) {
      console.error("Error fetching sales:", error);
      toast.error("Failed to fetch sales invoices");
      setSales([]);
    } finally {
      setSalesLoading(false);
    }
  };

  useEffect(() => {
    if (customerId && returnType === "SALE") {
      handleSaleInvoiceByCustomer(customerId);
    } else {
      setSales([]);
    }
    form.setValue("saleId", "");
  }, [customerId, returnType, form]);

  const { fields, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");
  const selectedReturnType = returnTypeOptions.find(
    (opt) => opt.value === returnType
  );

  const totalAmount = watchedItems.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0
  );

  const handleSaleSelect = (saleId: string) => {
    const selectedSale = sales?.find((sale) => sale.id === saleId);
    if (selectedSale) {
      const saleItems = selectedSale.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        taxAmount: item.taxPercent || 0,
        discount: item.discount || 0,
        unitPrice: item.unitPrice,
        note: "",
      }));
      form.setValue("items", saleItems);
    }
  };

  const handlePurchaseSelect = (purchaseId: string) => {
    const selectedPurchase = purchases?.find(
      (purchase) => purchase.id === purchaseId
    );

    if (selectedPurchase) {
      const purchaseItems = selectedPurchase.purchaseItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        taxAmount: item.taxPercent || 0,
        discount: item.discount || 0,
        unitPrice: item.unitCost,
        note: "",
      }));
      form.setValue("items", purchaseItems);
    }
  };

  const handleCustomerChange = (customerId: string) => {
    form.setValue("customerId", customerId);
  };

  const onSubmit = async (data: ReturnFormOutput) => {
    const payload: ReturnFormData = {
      returnCode: data.returnCode,
      // The form holds a `yyyy-mm-dd` string; the action's payload wants a Date.
      returnDate: new Date(data.returnDate),
      // `ReturnFormSchema` narrows `returnType` with `.refine()` on a plain
      // string, so the literal union is only guaranteed at runtime.
      returnType: data.returnType as ReturnFormData["returnType"],
      customerId: data.customerId ?? "",
      // This form collects no supplier and `addReturn` never reads the field;
      // sent empty to satisfy the action's payload type.
      supplierId: "",
      reason: data.reason,
      items: data.items,
    };

    const res = createReturn(payload);
    return toast.promise(res, {
      loading: "Creating returns...",
      success: (response) => {
        form.reset();
        return "Return created successfully";
      },
      error: (err) =>
        err?.response?.data?.message || "Failed to create returns",
    });
  };

  const filteredSales = sales || [];

  return (
    <div>
      <Card className="border-0 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <div className="p-1.5 bg-blue-100 rounded-md">
              <RotateCcw className="h-4 w-4 text-blue-600" />
            </div>
            Return Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="returnCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700">
                        Return Code *
                      </FormLabel>
                      <FormControl>
                        <Input {...field} disabled className="bg-slate-50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="returnType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700">
                        Return Type *
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("customerId", "");
                          form.setValue("saleId", "");
                          form.setValue("purchaseId", "");
                          setSales([]);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select return type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {returnTypeOptions.map(
                            ({ value, label, icon: Icon, color }) => (
                              <SelectItem value={value} key={value}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-2 h-2 rounded-full ${color}`}
                                  />
                                  <Icon className="w-4 h-4" />
                                  {label}
                                </div>
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="returnDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Return Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {returnType === "PURCHASE" ? (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="purchaseId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">
                          Purchase Invoice *
                        </FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            handlePurchaseSelect(value);
                          }}
                          value={field.value}
                          disabled={!purchases?.length}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10">
                              <SelectValue
                                placeholder={
                                  !purchases?.length
                                    ? "No purchases found"
                                    : "Select purchase invoice"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {purchases?.map((purchase) => (
                              <SelectItem key={purchase.id} value={purchase.id}>
                                {purchase.purchaseCode} —{" "}
                                {format(
                                  new Date(purchase.createdAt),
                                  "dd MMM yyyy"
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">
                          Customer *
                        </FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleCustomerChange(value);
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers?.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {customerId && (
                    <FormField
                      control={form.control}
                      name="saleId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-slate-700">
                            Sale Invoice *
                          </FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              handleSaleSelect(value);
                            }}
                            value={field.value}
                            disabled={salesLoading || !filteredSales.length}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10">
                                <SelectValue
                                  placeholder={
                                    salesLoading
                                      ? "Loading sales..."
                                      : !filteredSales.length
                                        ? "No sales found for this customer"
                                        : "Select sale invoice"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredSales.map((sale) => (
                                <SelectItem key={sale.id} value={sale.id}>
                                  {sale.saleCode} —{" "}
                                  {format(
                                    new Date(sale.createdAt),
                                    "dd MMM yyyy"
                                  )}{" "}
                                  - ${sale.totalAmount?.toFixed(2)}
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
              )}

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">
                      Reason (Optional)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter reason for return..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Return Items
                  </h3>
                  {salesLoading && (
                    <div className="text-sm text-slate-500">
                      Loading items...
                    </div>
                  )}
                </div>

                {fields.map((field, index) => (
                  <Card
                    key={field.id}
                    className="p-4 space-y-4 border border-slate-200"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      <div className="md:col-span-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.productId`}
                          render={({ field }) => {
                            const selectedProduct = products?.find(
                              (p) => p.id === field.value
                            );

                            return (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-slate-600">
                                  Product *
                                </FormLabel>
                                <div className="p-2 bg-slate-100 rounded text-sm text-slate-700 min-h-[40px] flex items-center">
                                  {selectedProduct ? (
                                    <div>
                                      <div className="font-medium">
                                        {selectedProduct.name}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        {selectedProduct.productCode} — $
                                        {selectedProduct.unitPrice}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">
                                      No product selected
                                    </span>
                                  )}
                                </div>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-slate-600">
                                Quantity *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  className="h-9"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.unitPrice`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-slate-600">
                                Unit Price *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="h-9"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.taxAmount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-slate-600">
                                Tax Amount
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="h-9"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.discount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-slate-600">
                                Discount
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="h-9"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-1">
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-9 w-9 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-right text-slate-500">
                      Item Total: $
                      {(
                        (watchedItems[index]?.quantity || 0) *
                        (watchedItems[index]?.unitPrice || 0)
                      ).toFixed(2)}
                    </div>
                  </Card>
                ))}
              </div>

              <Separator />

              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">
                    Return Summary
                  </span>
                  {selectedReturnType && (
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <selectedReturnType.icon className="h-3 w-3" />
                      {selectedReturnType.label}
                    </Badge>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">
                    Total Items: {fields.length}
                  </span>
                  <span className="font-medium">
                    Total Amount: ${totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={salesLoading}
                >
                  {salesLoading ? "Loading..." : "Create Return"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/returns")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
