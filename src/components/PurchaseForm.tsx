"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Package } from "lucide-react";
import { createPurchase } from "@/actions/purchase";
import { toast } from "sonner";
import { generateCode } from "@/lib/utils";
import {
  PurchaseFormInput,
  PurchaseFormOutput,
  PurchaseFormSchema,
} from "@/validations/schemas";
import type { PurchaseFormData } from "@/types/purchase";

type PurchaseProductOption = {
  id: string;
  name: string;
  productCode: string;
  unit: string;
  unitCost: number;
};

type PurchaseSupplierOption = {
  id: string;
  companyName: string;
  supplierCode: string;
};

type PurchaseStatusOption = {
  value: string;
  label: string;
};

export default function PurchaseForm({
  products,
  suppliers,
  statusOptions
}: {
  products?: PurchaseProductOption[];
  suppliers?: PurchaseSupplierOption[];
  statusOptions: PurchaseStatusOption[];
}) {
  const form = useForm<PurchaseFormInput>({
    resolver: zodResolver(PurchaseFormSchema),
    defaultValues: {
      supplierId: "",
      purchaseCode: "",
      purchaseDate: new Date().toISOString().split("T")[0],
      status: "Pending",
      discount: 0,
      taxAmount: 0,
      productId: "",
      quantity: 1,
      unitCost: 0,
      batchNumber: "",
      expiryDate: "",
      taxPercent: 0,
      itemDiscount: 0,
    },
  });
  useEffect(() => {
    const code = generateCode("PO");
    form.setValue("purchaseCode", code);
  }, []);
  const watched = form.watch();

  const getProductDetails = (productId: string) => {
    return products?.find((p) => p.id === productId);
  };

  const calculateItemTotal = () => {
    const subtotal = watched.quantity * watched.unitCost;
    const discountAmount = watched.itemDiscount || 0;
    const taxAmount =
      ((watched.taxPercent || 0) / 100) * (subtotal - discountAmount);
    return subtotal - discountAmount + taxAmount;
  };

  const calculateGrandTotal = () => {
    const itemTotal = calculateItemTotal();
    const globalDiscount = watched.discount || 0;
    const globalTax = watched.taxAmount || 0;
    return itemTotal - globalDiscount + globalTax;
  };

  const onSubmit = async (values: PurchaseFormOutput) => {
    // The schema is flat (one product) while the action takes a header plus an
    // `items` array, and its dates are real `Date`s rather than ISO strings.
    const payload: PurchaseFormData = {
      purchaseCode: values.purchaseCode,
      supplierId: values.supplierId,
      purchaseDate: new Date(values.purchaseDate),
      status: values.status,
      discount: values.discount,
      taxAmount: values.taxAmount,
      totalAmount: calculateGrandTotal(),
      items: [
        {
          productId: values.productId,
          quantity: values.quantity,
          unitCost: values.unitCost,
          totalCost: values.quantity * values.unitCost,
          batchNumber: values.batchNumber,
          expiryDate: values.expiryDate
            ? new Date(values.expiryDate)
            : undefined,
          taxPercent: values.taxPercent,
          itemDiscount: values.itemDiscount,
        },
      ],
    };
    const res = createPurchase(payload);
    return toast.promise(res, {
      loading: "Creating purchase...",
      success: (response) => {
        form.reset();
        const newCode = generateCode("PO");
        form.setValue("purchaseCode", newCode);
        return "purchase created successfully";
      },
      error: (err) =>
        err?.response?.data?.message || "Failed to create purchase",
    });
  };

  const selectedProduct = getProductDetails(watched.productId);

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary rounded-md">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Create Purchase Order</h1>
              <p className="text-sm text-muted-foreground">
                Add order with supplier and product
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Purchase Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="purchaseCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Code *</FormLabel>
                      <FormControl>
                        <Input type="text" {...field} disabled />
                      </FormControl>
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
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers?.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.companyName} ({supplier.supplierCode})
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
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

          <Card>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          const product = getProductDetails(value);
                          if (product) {
                            form.setValue("unitCost", product.unitCost);
                          }
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({product.productCode}) -{" "}
                              {product.unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedProduct && (
                  <div className="flex items-end">
                    <div className="space-y-1">
                      <FormLabel>Product Info</FormLabel>
                      <div className="p-3 bg-muted rounded-md text-sm">
                        <p className="font-medium">{selectedProduct.name}</p>
                        <p className="text-muted-foreground">
                          {selectedProduct.productCode} • Unit:{" "}
                          {selectedProduct.unit}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unitCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Cost *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
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
                  name="taxPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax %</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          {...field}
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
                  name="itemDiscount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Discount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="batchNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Item Total</p>
                  <p className="text-lg font-semibold">
                    ${calculateItemTotal().toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purchase Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Global Discount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
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
                  name="taxAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Tax</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="flex justify-end">
                <div className="text-right space-y-2">
                  <div className="text-2xl font-bold">
                    Total Amount: ${calculateGrandTotal().toFixed(2)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Including all taxes and discounts
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
            >
              Reset
            </Button>
            <Button type="submit" className="min-w-[140px]">
              Create
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
