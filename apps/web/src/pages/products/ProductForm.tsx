import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import useSWR from "swr";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ProductSchema } from "@dms/shared";
import { Button, Card, CardContent, Input, Skeleton, Switch, Label, Textarea } from "@dms/ui";
import { PageHeader } from "../../components/layout/PageHeader";
import { QueryError } from "../../components/layout/QueryError";
import { Field } from "../../components/common/Field";
import { NativeSelect } from "../../components/common/NativeSelect";
import { listPath, type Paginated } from "../../hooks/use-paginated";
import { useRevalidate } from "../../hooks/use-revalidate";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/fetcher";
import { OPTIONS_PAGE_SIZE, UNITS, type Brand, type Category, type Product } from "../../types/catalog";
import { NewBrandDialog, NewCategoryDialog } from "./CatalogDialogs";

type FormInput = z.input<typeof ProductSchema>;
type FormOutput = z.output<typeof ProductSchema>;

const EMPTY: FormInput = {
  name: "",
  productCode: "",
  category: "",
  brand: "",
  unit: "",
  description: "",
  unitCost: "",
  unitPrice: "",
  isActive: true,
};

const toForm = (product: Product): FormInput => ({
  name: product.name,
  productCode: product.productCode,
  category: product.categoryId,
  brand: product.brandId,
  unit: product.unit,
  description: product.description ?? "",
  unitCost: String(product.unitCost),
  unitPrice: String(product.unitPrice),
  isActive: product.isActive,
});

/** New and edit share one form; `:id` in the route is the difference. */
export default function ProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const revalidate = useRevalidate();

  const existing = useSWR<Product>(id ? `/products/${id}` : null);
  const categories = useSWR<Paginated<Category>>(listPath("/categories", { pageSize: OPTIONS_PAGE_SIZE }));

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(ProductSchema),
    defaultValues: EMPTY,
  });
  const { register, handleSubmit, watch, setValue, reset, formState } = form;
  const { errors, isSubmitting } = formState;

  useEffect(() => {
    if (existing.data) reset(toForm(existing.data));
  }, [existing.data, reset]);

  const categoryId = watch("category");
  const brands = useSWR<Paginated<Brand>>(
    categoryId ? listPath("/brands", { pageSize: OPTIONS_PAGE_SIZE, categoryId }) : null
  );

  // A native select drops a value it has no option for. On edit the brand is
  // set before its category's brands have loaded, so set it again once they do.
  useEffect(() => {
    const current = form.getValues("brand");
    if (brands.data && current) setValue("brand", current);
  }, [brands.data, form, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await api.put(`/products/${id}`, values);
        toast.success("Product updated");
      } else {
        await api.post("/products", values);
        toast.success("Product created");
      }
      await revalidate("/products", "/dashboard/stats");
      navigate("/product");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  if (existing.error) return <QueryError error={existing.error} onRetry={() => existing.mutate()} />;
  if (isEdit && !existing.data) return <Skeleton className="h-96" data-testid="form-skeleton" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isEdit ? "Edit Product" : "Add Product"}
        description={isEdit ? existing.data?.name : "Add a product to your catalogue"}
      />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2" noValidate aria-label="Product">
            <Field id="name" label="Product name" error={errors.name?.message}>
              <Input id="name" {...register("name")} />
            </Field>
            <Field id="productCode" label="Product code" error={errors.productCode?.message}>
              <Input id="productCode" {...register("productCode")} />
            </Field>

            <Field id="category" label="Category" error={errors.category?.message}>
              <NativeSelect
                id="category"
                {...register("category", { onChange: () => setValue("brand", "") })}
              >
                <option value="">Select a category</option>
                {categories.data?.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
              <NewCategoryDialog
                onCreated={(c) => {
                  setValue("category", c.id, { shouldValidate: true });
                  setValue("brand", "");
                }}
              />
            </Field>

            <Field id="brand" label="Brand" error={errors.brand?.message}>
              <NativeSelect id="brand" disabled={!categoryId} {...register("brand")}>
                <option value="">{categoryId ? "Select a brand" : "Select a category first"}</option>
                {brands.data?.data.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
              <NewBrandDialog
                categoryId={categoryId}
                onCreated={(b) => setValue("brand", b.id, { shouldValidate: true })}
              />
            </Field>

            <Field id="unit" label="Unit" error={errors.unit?.message}>
              <NativeSelect id="unit" {...register("unit")}>
                <option value="">Select a unit</option>
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="flex items-end gap-2 pb-2">
              <Switch
                id="isActive"
                checked={watch("isActive")}
                onCheckedChange={(checked) => setValue("isActive", checked)}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            <Field id="unitCost" label="Unit cost" error={errors.unitCost?.message}>
              <Input id="unitCost" inputMode="decimal" {...register("unitCost")} />
            </Field>
            <Field id="unitPrice" label="Unit price" error={errors.unitPrice?.message}>
              <Input id="unitPrice" inputMode="decimal" {...register("unitPrice")} />
            </Field>

            <Field id="description" label="Description" className="md:col-span-2">
              <Textarea id="description" {...register("description")} />
            </Field>

            <div className="flex justify-end gap-2 md:col-span-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/product">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Create product"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
