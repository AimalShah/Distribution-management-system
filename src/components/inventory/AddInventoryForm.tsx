"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Upload, Download, Copy, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import {
  bulkInventorySchema,
  type BulkInventory,
} from "@/components/inventory/validations";
import { mockSuppliers } from "@/lib/data/mock-data";
import { Card, CardContent } from "../ui/card";

interface InventoryModalProps {
  isOpen: boolean
  onClose: () => void
}


const generateId = () => Math.random().toString(36).substring(2, 9);


export function InventoryForms({ isOpen, onClose }: InventoryModalProps) {
  const categories = [
    "Electronics",
    "Accessories",
    "Clothing",
    "Home & Garden",
    "Sports",
    "Books",
    "Other",
  ];

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<BulkInventory>({
    resolver: zodResolver(bulkInventorySchema),
    defaultValues: {
      products: [
        {
          id: "",
          name: "",
          sku: "",
          category: "",
          price: 0,
          stock: 0,
          minStock: 0,
          supplierId: "",
          status: "active",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "products",
  });

  const watchedProducts = watch("products");

  const handleBulkSubmit = async (data: BulkInventory) => {
    const productsWithIds = data.products.map((product) => ({
      ...product,
      id: generateId(),
    }));
    await new Promise((res) => setTimeout(res, 1500));
    alert(`${productsWithIds.length} products added successfully!`);
  };

  const addRow = () => {
    append({
      id: "",
      name: "",
      sku: "",
      category: "",
      price: 0,
      stock: 0,
      minStock: 0,
      supplierId: "",
      status: "active",
    });
  };

  const removeRow = (index: number) => {
    if (fields.length > 1) remove(index);
  };

  const duplicateRow = (index: number) => {
    const product = watchedProducts[index];
    append({
      ...product,
      id: "",
      sku: `${product.sku}-copy`,
    });
  };

  const exportTemplate = () => {
    const csvContent = [
      "Name,SKU,Category,Price,Stock,Min Stock,Supplier ID,Status",
      "Sample Product,SKU-001,Electronics,99.99,100,10,1,active",
      "Another Product,SKU-002,Accessories,29.99,50,5,2,active",
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-7xl max-h-[90vh] rounded-lg shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b bg-gray-50/50">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Add Products
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Add single products or import in bulk
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium">Bulk Product Import</h4>
                    <p className="text-sm text-muted-foreground">
                      Add multiple products using the spreadsheet interface
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportTemplate}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </Button>
                  </div>
                </div>

                <form
                  onSubmit={handleSubmit(handleBulkSubmit)}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addRow}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Row
                      </Button>
                      <Badge variant="secondary" className="px-3 py-1">
                        {fields.length}{" "}
                        {fields.length === 1 ? "product" : "products"}
                      </Badge>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                      <div className="max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-gray-50 z-10">
                            <TableRow>
                              <TableHead className="w-[50px] text-center">
                                #
                              </TableHead>
                              <TableHead className="min-w-[200px]">
                                Product Name *
                              </TableHead>
                              <TableHead className="min-w-[120px]">
                                SKU *
                              </TableHead>
                              <TableHead className="min-w-[120px]">
                                Category *
                              </TableHead>
                              <TableHead className="min-w-[100px]">
                                Price *
                              </TableHead>
                              <TableHead className="min-w-[80px]">
                                Stock *
                              </TableHead>
                              <TableHead className="min-w-[100px]">
                                Min Stock *
                              </TableHead>
                              <TableHead className="min-w-[150px]">
                                Supplier *
                              </TableHead>
                              <TableHead className="min-w-[100px]">
                                Status
                              </TableHead>
                              <TableHead className="w-[100px] text-center">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {fields.map((field, index) => (
                              <TableRow
                                key={field.id}
                                className="group hover:bg-gray-50/50"
                              >
                                <TableCell className="font-medium text-center text-gray-500">
                                  {index + 1}
                                </TableCell>

                                <TableCell>
                                  <Input
                                    {...register(`products.${index}.name`)}
                                    placeholder="Enter product name"
                                    className={`h-9 ${
                                      errors.products?.[index]?.name
                                        ? "border-red-500"
                                        : ""
                                    }`}
                                  />
                                  {errors.products?.[index]?.name && (
                                    <p className="text-xs text-red-500 mt-1">
                                      {errors.products[index]?.name?.message}
                                    </p>
                                  )}
                                </TableCell>

                                <TableCell>
                                  <Input
                                    {...register(`products.${index}.sku`)}
                                    placeholder="SKU-001"
                                    className={`h-9 ${
                                      errors.products?.[index]?.sku
                                        ? "border-red-500"
                                        : ""
                                    }`}
                                  />
                                  {errors.products?.[index]?.sku && (
                                    <p className="text-xs text-red-500 mt-1">
                                      {errors.products[index]?.sku?.message}
                                    </p>
                                  )}
                                </TableCell>

                                <TableCell>
                                  <Select
                                    value={
                                      watchedProducts[index]?.category || ""
                                    }
                                    onValueChange={(value) =>
                                      setValue(
                                        `products.${index}.category`,
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      className={`h-9 ${
                                        errors.products?.[index]?.category
                                          ? "border-red-500"
                                          : ""
                                      }`}
                                    >
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {categories.map((category) => (
                                        <SelectItem
                                          key={category}
                                          value={category}
                                        >
                                          {category}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {errors.products?.[index]?.category && (
                                    <p className="text-xs text-red-500 mt-1">
                                      {
                                        errors.products[index]?.category
                                          ?.message
                                      }
                                    </p>
                                  )}
                                </TableCell>

                                <TableCell>
                                  <Input
                                    {...register(`products.${index}.price`, {
                                      valueAsNumber: true,
                                    })}
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className={`h-9 ${
                                      errors.products?.[index]?.price
                                        ? "border-red-500"
                                        : ""
                                    }`}
                                  />
                                  {errors.products?.[index]?.price && (
                                    <p className="text-xs text-red-500 mt-1">
                                      {errors.products[index]?.price?.message}
                                    </p>
                                  )}
                                </TableCell>

                                <TableCell>
                                  <Input
                                    {...register(`products.${index}.stock`, {
                                      valueAsNumber: true,
                                    })}
                                    type="number"
                                    placeholder="0"
                                    className={`h-9 ${
                                      errors.products?.[index]?.stock
                                        ? "border-red-500"
                                        : ""
                                    }`}
                                  />
                                  {errors.products?.[index]?.stock && (
                                    <p className="text-xs text-red-500 mt-1">
                                      {errors.products[index]?.stock?.message}
                                    </p>
                                  )}
                                </TableCell>

                                <TableCell>
                                  <Input
                                    {...register(`products.${index}.minStock`, {
                                      valueAsNumber: true,
                                    })}
                                    type="number"
                                    placeholder="0"
                                    className={`h-9 ${
                                      errors.products?.[index]?.minStock
                                        ? "border-red-500"
                                        : ""
                                    }`}
                                  />
                                  {errors.products?.[index]?.minStock && (
                                    <p className="text-xs text-red-500 mt-1">
                                      {
                                        errors.products[index]?.minStock
                                          ?.message
                                      }
                                    </p>
                                  )}
                                </TableCell>

                                <TableCell>
                                  <Select
                                    value={
                                      watchedProducts[index]?.supplierId || ""
                                    }
                                    onValueChange={(value) =>
                                      setValue(
                                        `products.${index}.supplierId`,
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      className={`h-9 ${
                                        errors.products?.[index]?.supplierId
                                          ? "border-red-500"
                                          : ""
                                      }`}
                                    >
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {mockSuppliers.map((supplier) => (
                                        <SelectItem
                                          key={supplier.id}
                                          value={supplier.id}
                                        >
                                          {supplier.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {errors.products?.[index]?.supplierId && (
                                    <p className="text-xs text-red-500 mt-1">
                                      {
                                        errors.products[index]?.supplierId
                                          ?.message
                                      }
                                    </p>
                                  )}
                                </TableCell>

                                <TableCell>
                                  <Select
                                    value={
                                      watchedProducts[index]?.status || "active"
                                    }
                                    onValueChange={(value) =>
                                      setValue(
                                        `products.${index}.status`,
                                        value as
                                          | "active"
                                          | "inactive"
                                          | "discontinued"
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="active">
                                        Active
                                      </SelectItem>
                                      <SelectItem value="inactive">
                                        Inactive
                                      </SelectItem>
                                      <SelectItem value="discontinued">
                                        Discontinued
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>

                                <TableCell>
                                  <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => duplicateRow(index)}
                                      title="Duplicate row"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeRow(index)}
                                      disabled={fields.length === 1}
                                      title="Delete row"
                                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>

                  {errors.products && (
                    <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md border border-red-200">
                      ⚠️ Please fix the validation errors above before
                      submitting.
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t bg-gray-50 -mx-6 px-6 py-4 -mb-6">
                    <div className="text-sm text-gray-600">
                      Total products to add:{" "}
                      <span className="font-medium">{fields.length}</span>
                    </div>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="min-w-[140px]"
                    >
                      {isSubmitting
                        ? "Saving..."
                        : `Save ${fields.length} Product${
                            fields.length !== 1 ? "s" : ""
                          }`}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
