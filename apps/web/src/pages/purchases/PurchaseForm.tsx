import { useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import useSWR from "swr";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PurchaseFormSchema, calculatePurchaseTotal, purchaseLineTotal } from "@dms/shared";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@dms/ui";
import { PageHeader } from "../../components/layout/PageHeader";
import { Field } from "../../components/common/Field";
import { NativeSelect } from "../../components/common/NativeSelect";
import { listPath, type Paginated } from "../../hooks/use-paginated";
import { useRevalidate } from "../../hooks/use-revalidate";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/fetcher";
import { asNumber, generateCode, todayInput } from "../../lib/form-values";
import { formatCurrency } from "../../lib/format";
import { OPTIONS_PAGE_SIZE, type Product } from "../../types/catalog";
import { PURCHASE_STATUSES, type Supplier } from "../../types/purchase";

type FormInput = z.input<typeof PurchaseFormSchema>;
type FormOutput = z.output<typeof PurchaseFormSchema>;

const emptyItem = () => ({
  productId: "",
  quantity: undefined as unknown as number,
  unitCost: undefined as unknown as number,
  batchNumber: "",
  expiryDate: "",
  taxPercent: undefined,
  itemDiscount: undefined,
});

/** A blank or half-typed number counts as 0 in the running total. */
const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export default function PurchaseForm() {
  const navigate = useNavigate();
  const revalidate = useRevalidate();
  const suppliers = useSWR<Paginated<Supplier>>(listPath("/suppliers", { pageSize: OPTIONS_PAGE_SIZE }));
  const products = useSWR<Paginated<Product>>(
    listPath("/products", { pageSize: OPTIONS_PAGE_SIZE, isActive: "true" })
  );

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(PurchaseFormSchema),
    defaultValues: {
      supplierId: "",
      purchaseCode: generateCode("PO"),
      purchaseDate: todayInput(),
      status: "Pending",
      discount: undefined,
      taxAmount: undefined,
      items: [emptyItem()],
    },
  });
  const { register, handleSubmit, control, watch, setValue, formState } = form;
  const { errors, isSubmitting } = formState;
  const items = useFieldArray({ control, name: "items" });

  const watched = watch();
  const totals = useMemo(() => {
    const lines = (watched.items ?? []).map((item) => ({
      quantity: n(item.quantity),
      unitCost: n(item.unitCost),
      taxPercent: n(item.taxPercent),
      itemDiscount: n(item.itemDiscount),
    }));
    return {
      lines: lines.map(purchaseLineTotal),
      subtotal: lines.reduce((sum, line) => sum + purchaseLineTotal(line), 0),
      total: calculatePurchaseTotal({
        items: lines,
        discount: n(watched.discount),
        taxAmount: n(watched.taxAmount),
      }),
    };
  }, [watched]);

  const productById = useMemo(
    () => new Map(products.data?.data.map((p) => [p.id, p]) ?? []),
    [products.data]
  );

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post("/purchases", values);
      toast.success("Purchase recorded");
      await revalidate("/purchases", "/inventory", "/products", "/dashboard/stats");
      navigate("/purchase");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="New Purchase" description="Record stock received from a supplier" />
      <form onSubmit={onSubmit} className="space-y-6" noValidate aria-label="Purchase">
        <Card>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
            <Field id="supplierId" label="Supplier" error={errors.supplierId?.message}>
              <NativeSelect id="supplierId" {...register("supplierId")}>
                <option value="">Select a supplier</option>
                {suppliers.data?.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.companyName}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="purchaseCode" label="Purchase code" error={errors.purchaseCode?.message}>
              <Input id="purchaseCode" {...register("purchaseCode")} />
            </Field>
            <Field id="purchaseDate" label="Purchase date" error={errors.purchaseDate?.message}>
              <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
            </Field>
            <Field id="status" label="Status" error={errors.status?.message}>
              <NativeSelect id="status" {...register("status")}>
                {PURCHASE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => items.append(emptyItem())}>
              <Plus className="mr-1 h-4 w-4" /> Add item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {errors.items?.root?.message || errors.items?.message ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.items?.root?.message ?? errors.items?.message}
              </p>
            ) : null}
            {items.fields.map((field, index) => {
              const itemErrors = errors.items?.[index];
              const label = (name: string) => `${name} (item ${index + 1})`;
              return (
                <div
                  key={field.id}
                  className="grid gap-3 rounded-lg border p-3 md:grid-cols-8"
                  data-testid="purchase-item"
                >
                  <Field id={`items.${index}.productId`} label={label("Product")} error={itemErrors?.productId?.message} className="md:col-span-2">
                    <NativeSelect
                      id={`items.${index}.productId`}
                      {...register(`items.${index}.productId`, {
                        // Prefill the cost from the catalogue; it stays editable,
                        // because what a supplier charges this time can differ.
                        onChange: (event) => {
                          const product = productById.get(event.target.value);
                          if (product) setValue(`items.${index}.unitCost`, product.unitCost);
                        },
                      })}
                    >
                      <option value="">Select a product</option>
                      {products.data?.data.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.productCode})
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field id={`items.${index}.quantity`} label={label("Quantity")} error={itemErrors?.quantity?.message}>
                    <Input id={`items.${index}.quantity`} inputMode="numeric" {...register(`items.${index}.quantity`, { setValueAs: asNumber })} />
                  </Field>
                  <Field id={`items.${index}.unitCost`} label={label("Unit cost")} error={itemErrors?.unitCost?.message}>
                    <Input id={`items.${index}.unitCost`} inputMode="decimal" {...register(`items.${index}.unitCost`, { setValueAs: asNumber })} />
                  </Field>
                  <Field id={`items.${index}.batchNumber`} label={label("Batch")}>
                    <Input id={`items.${index}.batchNumber`} {...register(`items.${index}.batchNumber`)} />
                  </Field>
                  <Field id={`items.${index}.expiryDate`} label={label("Expiry")}>
                    <Input id={`items.${index}.expiryDate`} type="date" {...register(`items.${index}.expiryDate`)} />
                  </Field>
                  <Field id={`items.${index}.taxPercent`} label={label("Tax %")} error={itemErrors?.taxPercent?.message}>
                    <Input id={`items.${index}.taxPercent`} inputMode="decimal" {...register(`items.${index}.taxPercent`, { setValueAs: asNumber })} />
                  </Field>
                  <div className="flex items-end justify-between gap-2">
                    <div className="text-sm">
                      <div className="text-xs text-muted-foreground">Line total</div>
                      <div className="font-semibold" data-testid="line-total">
                        {formatCurrency(totals.lines[index])}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove item ${index + 1}`}
                      disabled={items.fields.length === 1}
                      onClick={() => items.remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
            <Field id="discount" label="Discount" error={errors.discount?.message}>
              <Input id="discount" inputMode="decimal" {...register("discount", { setValueAs: asNumber })} />
            </Field>
            <Field id="taxAmount" label="Additional tax" error={errors.taxAmount?.message}>
              <Input id="taxAmount" inputMode="decimal" {...register("taxAmount", { setValueAs: asNumber })} />
            </Field>
            <div className="text-sm">
              <div className="text-muted-foreground">Subtotal</div>
              <div className="text-lg font-semibold" data-testid="subtotal">
                {formatCurrency(totals.subtotal)}
              </div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground">Total</div>
              <div className="text-2xl font-bold" data-testid="grand-total">
                {formatCurrency(totals.total)}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/purchase">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Record purchase"}
          </Button>
        </div>
      </form>
    </div>
  );
}
