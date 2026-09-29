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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

import { Save } from "lucide-react";
import AddCategoryModal from "@/components/Category";
import { createCategory } from "@/actions/category";
import { createProduct } from "@/actions/product";
import { ProductFormData } from "@/types/product";
import AddBrandModal from "@/components/Brand";
import { createBrand } from "@/actions/brand";
import { generateCode } from "@/lib/utils";
import { toast } from "sonner";
import { mutate } from "swr";
import {
  ProductInput,
  ProductOutput,
  ProductSchema,
} from "@/validations/schemas";

interface CategoryOption {
  id: string;
  name: string;
}

interface BrandOption {
  id: string;
  name: string;
  categoryId: string;
}

const units = [
  { value: "pcs", label: "Pieces" },
  { value: "kg", label: "Kilograms" },
  { value: "ltr", label: "Liters" },
  { value: "box", label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "m", label: "Meters" },
  { value: "g", label: "Grams" },
];

export default function ProductForm({
  categories,
  brands,
}: {
  categories?: CategoryOption[] | null;
  brands?: BrandOption[] | null;
}) {
  // `ProductInput` is what the inputs hold (raw strings) and `ProductOutput` is
  // what the zod schema parses them into, so the form is typed
  // <input, context, output>. No `context` is ever passed, so `unknown` is the
  // honest type for it. The `FormField`s below let `control` drive inference.
  const form = useForm<ProductInput, unknown, ProductOutput>({
    resolver: zodResolver(ProductSchema),
    defaultValues: {
      productCode: "",
      name: "",
      category: "",
      unit: "",
      brand: "",
      description: "",
      unitCost: "",
      unitPrice: "",
      isActive: true,
    },
  });

  useEffect(() => {
    const code = generateCode("PRO");
    form.setValue("productCode", code);
  }, []);

  const calculateMargin = (cost: string, price: string) => {
    const costNum = Number(cost);
    const priceNum = Number(price);
    if (costNum && priceNum && costNum > 0) {
      return (((priceNum - costNum) / priceNum) * 100).toFixed(1);
    }
    return "0";
  };

  const addCategory = async (
    categoryName: string,
    description: string
  ): Promise<void> => {
    const payload = {
      name: categoryName,
      description,
    };
    await toast.promise(createCategory(payload), {
      loading: "Creating category...",
      success: () => {
        return "category created successfully";
      },
      error: (err) =>
        err?.response?.data?.message || "Failed to create category",
    });
  };
  const addBrand = async (
    brandName: string,
    categoryId: string,
    description: string
  ): Promise<void> => {
    const payload = {
      name: brandName,
      categoryId,
      description,
    };

    await toast.promise(createBrand(payload), {
      loading: "Creating brand...",
      success: () => {
        return "brand created successfully";
      },
      error: (err) => err?.response?.data?.message || "Failed to create brand",
    });
  };

  const onSubmit = async (values: ProductOutput) => {
    // `values` is the zod-parsed output, so the cost/price are already numbers.
    const payload: ProductFormData = {
      name: values.name,
      productCode: values.productCode,
      category: values.category,
      unit: values.unit,
      brand: values.brand,
      description: values.description ?? "",
      unitCost: values.unitCost,
      unitPrice: values.unitPrice,
      isActive: values.isActive,
    };

    await toast.promise(createProduct(payload), {
      loading: "Creating product...",
      success: () => {
        // Re-run every SWR request; the product list itself is revalidated
        // server-side by the createProduct action's revalidatePath.
        mutate(() => true);
        form.reset();
        const newCode = generateCode("PRO");
        form.setValue("productCode", newCode);
        return "prodcut created successfully";
      },
      error: (err) =>
        err?.response?.data?.message || "Failed to create product",
    });
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-6">
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg"></CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name={`name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Name *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter product name"
                              {...field}
                              className="transition-all focus:ring-2 focus:ring-blue-500/20"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`productCode`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Code *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="transition-all focus:ring-2 focus:ring-blue-500/20"
                              disabled
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`category`}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-sm font-medium text-slate-700">
                              Category *
                            </FormLabel>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories?.map((category) => (
                                  <SelectItem
                                    key={category.id}
                                    value={category.id}
                                  >
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <AddCategoryModal onAddCategory={addCategory} />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Classification
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name={`brand`}
                      render={({ field }) => {
                        const selectedCategoryId = form.watch("category");
                        const filteredBrands = brands?.filter(
                          (b) => b.categoryId === selectedCategoryId
                        );

                        return (
                          <FormItem>
                            <FormLabel>Brand *</FormLabel>
                            <div className="flex items-center gap-2">
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={!selectedCategoryId}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20">
                                    <SelectValue placeholder="Select brand" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {filteredBrands?.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                      {b.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <AddBrandModal
                                onAddBrand={addBrand}
                                categories={categories ?? []}
                              />
                            </div>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={form.control}
                      name={`unit`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-slate-700">
                            Unit *
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20">
                                <SelectValue placeholder="Select unit" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {units.map((unit) => (
                                <SelectItem key={unit.value} value={unit.value}>
                                  {unit.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Pricing Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name={`unitCost`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Cost *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              className="transition-all focus:ring-2 focus:ring-blue-500/20"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`unitPrice`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Price *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              className="transition-all focus:ring-2 focus:ring-blue-500/20"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-end">
                      <div className="w-full">
                        <FormLabel className="text-sm">Profit Margin</FormLabel>
                        <div className="h-10 flex items-center px-3 border rounded-md bg-muted/50">
                          <span className="text-sm font-medium">
                            {calculateMargin(
                              form.watch(`unitCost`) || "0",
                              form.watch(`unitPrice`) || "0"
                            )}
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Additional Details
                  </h4>
                  <FormField
                    control={form.control}
                    name={`description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter product description..."
                            className="min-h-[80px] transition-all focus:ring-2 focus:ring-blue-500/20"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`isActive`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4 bg-muted/30">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">
                            Active Product
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            This product will be available for sale and visible
                            in the inventory.
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center p-6 bg-muted/30 rounded-lg">
            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                type="submit"
                className="flex-1 sm:flex-none min-w-[140px]"
              >
                <Save className="h-4 w-4 mr-2" />
                Create Products
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}
