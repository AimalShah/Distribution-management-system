import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { ArrowLeft, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { ProductSchema, type ProductFormData } from "@dms/shared";
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
  DialogTrigger,
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
  Textarea,
} from "@dms/ui";
import { api, failureMessage, fetcher } from "../../lib/api";
import { generateCode } from "../../lib/code";

interface CategoryOption {
  id: string;
  name: string;
}

interface BrandOption {
  id: string;
  name: string;
  categoryId: string;
}

const UNITS = [
  { value: "pcs", label: "Pieces" },
  { value: "kg", label: "Kilograms" },
  { value: "ltr", label: "Liters" },
  { value: "box", label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "m", label: "Meters" },
  { value: "g", label: "Grams" },
];

export interface ProductFormProps {
  productId?: string;
  initialData?: any;
  isEditing?: boolean;
}

export function ProductForm({ productId, initialData, isEditing = false }: ProductFormProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Categories & Brands fetching
  const { data: categoriesData, mutate: mutateCategories } = useSWR(
    "/categories?page=1&pageSize=100",
    fetcher
  );

  const categories: CategoryOption[] = categoriesData?.data ?? [];

  const { data: brandsData, mutate: mutateBrands } = useSWR(
    "/brands?page=1&pageSize=100",
    fetcher
  );

  const brands: BrandOption[] = brandsData?.data ?? [];

  // Quick Category creation modal state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Quick Brand creation modal state
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandCategory, setNewBrandCategory] = useState("");
  const [newBrandDesc, setNewBrandDesc] = useState("");
  const [creatingBrand, setCreatingBrand] = useState(false);

  const form = useForm<any>({
    resolver: zodResolver(ProductSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      productCode: initialData?.productCode ?? generateCode("PRO"),
      category: initialData?.categoryId ?? initialData?.category?.id ?? "",
      unit: initialData?.unit ?? "pcs",
      brand: initialData?.brandId ?? initialData?.brand?.id ?? "",
      description: initialData?.description ?? "",
      unitCost: initialData?.unitCost !== undefined ? String(initialData.unitCost) : "",
      unitPrice: initialData?.unitPrice !== undefined ? String(initialData.unitPrice) : "",
      isActive: initialData?.isActive ?? true,
      gstApplicable: initialData?.gstApplicable ?? true,
      gstRate: initialData?.gstRate !== undefined ? Number(initialData.gstRate) : 0,
    },
  });

  // Re-populate if initialData loads asynchronously
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name ?? "",
        productCode: initialData.productCode ?? "",
        category: initialData.categoryId ?? initialData.category?.id ?? "",
        unit: initialData.unit ?? "pcs",
        brand: initialData.brandId ?? initialData.brand?.id ?? "",
        description: initialData.description ?? "",
        unitCost: initialData.unitCost !== undefined ? String(initialData.unitCost) : "",
        unitPrice: initialData.unitPrice !== undefined ? String(initialData.unitPrice) : "",
        isActive: initialData.isActive ?? true,
        gstApplicable: initialData.gstApplicable ?? true,
        gstRate: initialData.gstRate !== undefined ? Number(initialData.gstRate) : 0,
      });
    }
  }, [initialData, form]);

  const selectedCategory = form.watch("category");
  const unitCostWatch = form.watch("unitCost");
  const unitPriceWatch = form.watch("unitPrice");

  const filteredBrands = brands.filter((b) =>
    selectedCategory ? b.categoryId === selectedCategory : true
  );

  const calculateMargin = (cost: string | number, price: string | number) => {
    const costNum = Number(cost);
    const priceNum = Number(price);

    if (costNum >= 0 && priceNum > 0) {
      return (((priceNum - costNum) / priceNum) * 100).toFixed(1);
    }

    return "0.0";
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a category name");

      return;
    }

    setCreatingCategory(true);

    try {
      const created = await api.post("/categories", {
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim() || undefined,
      });

      toast.success("Category created successfully");
      await mutateCategories();
      form.setValue("category", created.id);
      setNewCategoryName("");
      setNewCategoryDesc("");
      setCategoryModalOpen(false);
    } catch (err: any) {
      toast.error(failureMessage(err, "Failed to create category"));
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleCreateBrand = async () => {
    const targetCategory = newBrandCategory || selectedCategory;

    if (!newBrandName.trim()) {
      toast.error("Please enter a brand name");

      return;
    }

    if (!targetCategory) {
      toast.error("Please select a category for this brand");

      return;
    }

    setCreatingBrand(true);

    try {
      const created = await api.post("/brands", {
        name: newBrandName.trim(),
        categoryId: targetCategory,
        description: newBrandDesc.trim() || undefined,
      });

      toast.success("Brand created successfully");
      await mutateBrands();
      form.setValue("brand", created.id);
      setNewBrandName("");
      setNewBrandCategory("");
      setNewBrandDesc("");
      setBrandModalOpen(false);
    } catch (err: any) {
      toast.error(failureMessage(err, "Failed to create brand"));
    } finally {
      setCreatingBrand(false);
    }
  };

  const onSubmit = async (values: ProductFormData) => {
    setSubmitting(true);

    try {
      const payload = {
        name: values.name,
        productCode: values.productCode,
        category: values.category,
        brand: values.brand,
        unit: values.unit,
        description: values.description ?? "",
        unitCost: Number(values.unitCost),
        unitPrice: Number(values.unitPrice),
        isActive: Boolean(values.isActive),
      };

      if (isEditing && productId) {
        await api.put(`/products/${productId}`, payload);
        toast.success("Product updated successfully");
      } else {
        await api.post("/products", payload);
        toast.success("Product created successfully");
      }

      navigate("/products");
    } catch (err: any) {
      toast.error(failureMessage(err, "Failed to save product"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateSku = () => {
    const brandId = form.getValues("brand");
    const catId = form.getValues("category");
    const brandObj = brands.find((b) => b.id === brandId);
    const catObj = categories.find((c) => c.id === catId);
    const brandPrefix = brandObj ? brandObj.name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "") || "BRD" : "DMS";
    const catPrefix = catObj ? catObj.name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "") || "CAT" : "PRD";
    const rand = Math.floor(1000 + Math.random() * 9000);
    form.setValue("productCode", `${brandPrefix}-${catPrefix}-${rand}`, { shouldValidate: true });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="max-w-4xl mx-auto rounded-md border border-border shadow-none">
          <CardHeader className="p-4 sm:px-6 sm:py-4 border-b border-border bg-muted/10">
            <CardTitle className="text-base font-semibold">{isEditing ? "Edit Product" : "Product Details"}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Widget" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="productCode"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Product Code / SKU *</FormLabel>
                        <button
                          type="button"
                          onClick={handleGenerateSku}
                          className="text-xs text-primary font-medium hover:underline cursor-pointer"
                        >
                          Auto SKU
                        </button>
                      </div>
                      <FormControl>
                        <Input placeholder="PRO-XXXXX" className="font-mono text-xs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <div className="flex items-center gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="shrink-0"
                              title="Add new category"
                            >
                              <Plus className="size-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add New Category</DialogTitle>
                              <DialogDescription>
                                Create a new category for products in your organization.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3 py-2">
                              <div>
                                <label className="text-sm font-medium">Category Name *</label>
                                <Input
                                  value={newCategoryName}
                                  onChange={(e) => setNewCategoryName(e.target.value)}
                                  placeholder="e.g. Beverages"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium">Description</label>
                                <Input
                                  value={newCategoryDesc}
                                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                                  placeholder="Optional description"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCategoryModalOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={handleCreateCategory}
                                disabled={creatingCategory || !newCategoryName.trim()}
                              >
                                {creatingCategory ? (
                                  <Loader2 className="size-4 animate-spin mr-1" />
                                ) : null}
                                Save Category
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Classification</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand *</FormLabel>
                      <div className="flex items-center gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select brand" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredBrands.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog open={brandModalOpen} onOpenChange={setBrandModalOpen}>
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="shrink-0"
                              title="Add new brand"
                            >
                              <Plus className="size-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add New Brand</DialogTitle>
                              <DialogDescription>
                                Create a new brand under a category.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3 py-2">
                              <div>
                                <label className="text-sm font-medium">Brand Name *</label>
                                <Input
                                  value={newBrandName}
                                  onChange={(e) => setNewBrandName(e.target.value)}
                                  placeholder="e.g. Acme"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium">Category *</label>
                                <Select
                                  value={newBrandCategory || selectedCategory}
                                  onValueChange={setNewBrandCategory}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map((c) => (
                                      <SelectItem key={c.id} value={c.id}>
                                        {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Description</label>
                                <Input
                                  value={newBrandDesc}
                                  onChange={(e) => setNewBrandDesc(e.target.value)}
                                  placeholder="Optional description"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setBrandModalOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={handleCreateBrand}
                                disabled={
                                  creatingBrand ||
                                  !newBrandName.trim() ||
                                  (!newBrandCategory && !selectedCategory)
                                }
                              >
                                {creatingBrand ? (
                                  <Loader2 className="size-4 animate-spin mr-1" />
                                ) : null}
                                Save Brand
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u.value} value={u.value}>
                              {u.label}
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
              <h3 className="text-sm font-medium text-muted-foreground">Pricing Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unitPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Price *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <Label>Profit Margin</Label>
                  <div className="h-9 mt-2 flex items-center px-3 rounded-md border bg-muted/50">
                    <span className="text-sm font-medium">
                      {calculateMargin(unitCostWatch || "0", unitPriceWatch || "0")}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">GST / Tax Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <FormField
                  control={form.control}
                  name="gstApplicable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>GST Applicable</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Enable GST calculation for this product
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gstRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GST Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="e.g. 18"
                          disabled={!form.watch("gstApplicable")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Additional Details</h3>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter product description..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">Active Product</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Available for sale and visible in inventory.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/products")}
            disabled={submitting}
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Products
          </Button>

          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            {isEditing ? "Update Product" : "Create Product"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
