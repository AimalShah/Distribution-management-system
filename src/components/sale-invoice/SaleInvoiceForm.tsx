"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  ShoppingCart,
  User,
  Calculator,
  Receipt,
  Trash2,
  Package,
} from "lucide-react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { generateSaleInvoiceCode } from "@/lib/utils";
import { createSaleInvoice } from "@/actions/saleInvoice";
import { toast } from "sonner";
import {
  SaleInvoiceInput,
  SaleInvoiceItemInput,
  SaleInvoiceOutput,
  SaleInvoiceSchema,
} from "@/validations/schemas";
import type { SaleInvoiceFormData } from "@/types/saleInvoice";
import type { fetchCustomers } from "@/actions/customer";
import type { fetchProducts } from "@/actions/product";

type CustomerOption = NonNullable<
  Awaited<ReturnType<typeof fetchCustomers>>["data"]
>[number];

type ProductOption = NonNullable<
  Awaited<ReturnType<typeof fetchProducts>>["data"]
>[number];

export default function SaleInvoiceForm({
  customers,
  products,
}: {
  customers?: CustomerOption[];
  products?: ProductOption[];
}) {
  // The schema parses the form into a validated shape, so the values the form
  // holds (raw input) and the values the submit handler receives (parsed) are
  // different types: `useForm<input, context, output>`. No `context` is ever
  // passed, so `unknown` is the honest type for it. The `FormField`s below let
  // `control` drive the generic inference.
  const form = useForm<SaleInvoiceInput, unknown, SaleInvoiceOutput>({
    resolver: zodResolver(SaleInvoiceSchema),
    defaultValues: {
      saleCode: "",
      customerId: "",
      taxAmount: 0,
      discount: 0,
      status: "Pending",
      saleItems: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "saleItems",
  });

  useEffect(() => {
    const code = generateSaleInvoiceCode();
    form.setValue("saleCode", code);
  }, [form]);

  const { subtotal, total, taxAmount, discountAmount } = useMemo(() => {
    const saleItems = form.watch("saleItems") || [];
    const subtotal = saleItems.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0
    );
    const tax = form.watch("taxAmount") || 0;
    const discount = form.watch("discount") || 0;
    const total = subtotal + tax - discount;

    return {
      subtotal,
      total,
      taxAmount: tax,
      discountAmount: discount,
    };
  }, [
    form.watch("saleItems"),
    form.watch("taxAmount"),
    form.watch("discount"),
  ]);

  const addSaleItem = () => {
    append({
      productId: "",
      productName: "",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    });
  };

  const updateSaleItem = (
    index: number,
    field: "productId" | "quantity" | "unitPrice",
    value: string | number
  ) => {
    const currentItems = form.getValues("saleItems");
    const current = currentItems[index];

    const product =
      field === "productId"
        ? products?.find((p) => p.id === String(value))
        : undefined;

    const quantity = field === "quantity" ? Number(value) : current.quantity;
    const unitPrice =
      field === "unitPrice"
        ? Number(value)
        : product
          ? product.unitPrice
          : current.unitPrice;

    const updatedItem: SaleInvoiceItemInput = {
      ...current,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
    };
    if (field === "productId") {
      updatedItem.productId = String(value);
    }
    if (product) {
      updatedItem.productName = product.name;
    }

    const newItems = [...currentItems];
    newItems[index] = updatedItem;
    form.setValue("saleItems", newItems);
    form.trigger(`saleItems.${index}`);
  };

  const removeSaleItem = (index: number) => {
    remove(index);
  };

  const onSubmit = async (data: SaleInvoiceOutput) => {
    const saleData: SaleInvoiceFormData = {
      saleCode: data.saleCode,
      customerId: data.customerId,
      saleDate: new Date(),
      totalAmount: total,
      taxAmount: data.taxAmount || 0,
      discount: data.discount || 0,
      status: data.status || "Pending",
      items: data.saleItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        taxPercent: item.taxPercent,
      })),
    };

    const res = createSaleInvoice(saleData);
    return toast.promise(res, {
      loading: "Creating sale invoice...",
      success: (response) => {
        form.reset();
        const newCode = generateSaleInvoiceCode();
        form.setValue("saleCode", newCode);
        return "Sale invoice created successfully";
      },
      error: (err) =>
        err?.response?.data?.message || "Failed to create sale invoice",
    });
  };

  const selectedCustomer = customers?.find(
    (c) => c.id === form.watch("customerId")
  );

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            <div className="xl:col-span-3 space-y-8">
              <Card className="border-0 shadow-sm">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2 text-slate-800">
                    <div className="p-1.5 bg-blue-100 rounded-md">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    Customer Information
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Select the customer and configure invoice details
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="saleCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-slate-700">
                            Invoice Code
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled
                              className="bg-slate-50 border-slate-200 text-slate-600"
                            />
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
                          <FormLabel className="text-sm font-medium text-slate-700">
                            Customer *
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="Choose a customer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {customers?.map((customer) => (
                                <SelectItem
                                  key={customer.id}
                                  value={customer.id}
                                  className="py-3"
                                >
                                  <div className="flex flex-col gap-1">
                                    <span className="font-medium">
                                      {customer.name}
                                    </span>
                                    {customer.email && (
                                      <span className="text-xs text-slate-500">
                                        {customer.email}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {selectedCustomer && (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-100">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1 bg-emerald-100 rounded">
                          <User className="h-3 w-3 text-emerald-600" />
                        </div>
                        <h4 className="font-medium text-emerald-900">
                          Selected Customer
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 w-16">Name:</span>
                          <span className="font-medium text-slate-900">
                            {selectedCustomer.name}
                          </span>
                        </div>
                        {selectedCustomer.email && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 w-16">Email:</span>
                            <span className="text-slate-900">
                              {selectedCustomer.email}
                            </span>
                          </div>
                        )}
                        {selectedCustomer.phone && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 w-16">Phone:</span>
                            <span className="text-slate-900">
                              {selectedCustomer.phone}
                            </span>
                          </div>
                        )}
                        {selectedCustomer.address && (
                          <div className="md:col-span-2 flex items-start gap-2">
                            <span className="text-slate-600 w-16 mt-0.5">
                              Address:
                            </span>
                            <span className="text-slate-900">
                              {selectedCustomer.address}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-slate-800">
                        <div className="p-1.5 bg-amber-100 rounded-md">
                          <Package className="h-4 w-4 text-amber-600" />
                        </div>
                        Invoice Items
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        Add products and configure quantities
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      onClick={addSaleItem}
                      size="sm"
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {fields.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <div className="p-3 bg-slate-100 rounded-full w-fit mx-auto mb-4">
                        <ShoppingCart className="h-8 w-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-700 mb-2">
                        No items added yet
                      </h3>
                      <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                        Start building your invoice by adding products with
                        quantities and pricing.
                      </p>
                      <Button
                        type="button"
                        onClick={addSaleItem}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Your First Item
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 rounded-lg text-sm font-medium text-slate-600">
                        <div className="col-span-4">Product</div>
                        <div className="col-span-2">Quantity</div>
                        <div className="col-span-2">Unit Price</div>
                        <div className="col-span-3">Total</div>
                        <div className="col-span-1">Action</div>
                      </div>

                      {fields.map((field, index) => (
                        <div
                          key={field.id}
                          className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-4 space-y-1">
                              <Label className="text-xs font-medium text-slate-600 md:hidden">
                                Product *
                              </Label>
                              <Controller
                                name={`saleItems.${index}.productId`}
                                control={form.control}
                                render={({
                                  field: productField,
                                  fieldState,
                                }) => (
                                  <>
                                    <Select
                                      value={productField.value}
                                      onValueChange={(value) => {
                                        productField.onChange(value);
                                        updateSaleItem(
                                          index,
                                          "productId",
                                          value
                                        );
                                      }}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select product" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {products?.map((product) => (
                                          <SelectItem
                                            key={product.id}
                                            value={product.id}
                                          >
                                            <div className="flex flex-col py-1">
                                              <span className="font-medium">
                                                {product.name}
                                              </span>
                                              <span className="text-xs text-slate-500">
                                                ${product.unitPrice} per unit
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {fieldState.error && (
                                      <p className="text-xs text-red-500 mt-1">
                                        {fieldState.error.message}
                                      </p>
                                    )}
                                  </>
                                )}
                              />
                            </div>

                            <div className="md:col-span-2 space-y-1">
                              <Label className="text-xs font-medium text-slate-600 md:hidden">
                                Quantity *
                              </Label>
                              <Controller
                                name={`saleItems.${index}.quantity`}
                                control={form.control}
                                render={({
                                  field: quantityField,
                                  fieldState,
                                }) => (
                                  <>
                                    <Input
                                      type="number"
                                      min={1}
                                      className="h-9"
                                      value={quantityField.value || ""}
                                      onChange={(e) => {
                                        const value =
                                          parseInt(e.target.value) || 0;
                                        quantityField.onChange(value);
                                        updateSaleItem(
                                          index,
                                          "quantity",
                                          value
                                        );
                                      }}
                                    />
                                    {fieldState.error && (
                                      <p className="text-xs text-red-500 mt-1">
                                        {fieldState.error.message}
                                      </p>
                                    )}
                                  </>
                                )}
                              />
                            </div>

                            <div className="md:col-span-2 space-y-1">
                              <Label className="text-xs font-medium text-slate-600 md:hidden">
                                Unit Price *
                              </Label>
                              <Controller
                                name={`saleItems.${index}.unitPrice`}
                                control={form.control}
                                render={({ field: priceField, fieldState }) => (
                                  <>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min={0}
                                      className="h-9"
                                      value={priceField.value || ""}
                                      onChange={(e) => {
                                        const value =
                                          parseFloat(e.target.value) || 0;
                                        priceField.onChange(value);
                                        updateSaleItem(
                                          index,
                                          "unitPrice",
                                          value
                                        );
                                      }}
                                    />
                                    {fieldState.error && (
                                      <p className="text-xs text-red-500 mt-1">
                                        {fieldState.error.message}
                                      </p>
                                    )}
                                  </>
                                )}
                              />
                            </div>

                            <div className="md:col-span-3 space-y-1">
                              <Label className="text-xs font-medium text-slate-600 md:hidden">
                                Total
                              </Label>
                              <Controller
                                name={`saleItems.${index}.totalPrice`}
                                control={form.control}
                                render={({ field: totalField }) => (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    readOnly
                                    className="h-9 bg-slate-50 font-medium text-slate-700"
                                    value={
                                      totalField.value?.toFixed(2) || "0.00"
                                    }
                                  />
                                )}
                              />
                            </div>

                            <div className="md:col-span-1 flex items-end md:items-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSaleItem(index)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 h-9 w-9 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {form.formState.errors.saleItems?.root && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                      <p className="text-sm text-red-600">
                        {form.formState.errors.saleItems.root.message}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="xl:col-span-1 space-y-6">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 text-white sticky top-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Calculator className="h-5 w-5" />
                    Invoice Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Subtotal</span>
                      <span className="font-medium">
                        ${subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Tax</span>
                      <span className="font-medium text-green-300">
                        +${taxAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Discount</span>
                      <span className="font-medium text-red-300">
                        -${discountAmount.toFixed(2)}
                      </span>
                    </div>
                    <Separator className="bg-slate-600" />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Amount</span>
                      <span className="text-2xl text-emerald-400">
                        ${total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Invoice Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="taxAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Tax Amount
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="0.00"
                            className="h-9"
                            value={field.value || ""}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Discount
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="0.00"
                            className="h-9"
                            value={field.value || ""}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
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
                        <FormLabel className="text-sm font-medium">
                          Invoice Status
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6 space-y-3">
                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Creating Invoice...
                      </>
                    ) : (
                      <>
                        <Receipt className="mr-2 h-4 w-4" />
                        Create Invoice
                      </>
                    )}
                  </Button>
                  <Link href="/sales" className="block">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11"
                    >
                      Cancel
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}
