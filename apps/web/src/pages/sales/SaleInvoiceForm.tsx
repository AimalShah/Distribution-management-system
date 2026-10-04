import { useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import useSWR from "swr";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { SaleInvoiceSchema, SaleStatus, calculateSaleTotal, saleLineTotal } from "@dms/shared";
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
import type { Customer } from "../../types/sale";

type FormInput = z.input<typeof SaleInvoiceSchema>;
type FormOutput = z.output<typeof SaleInvoiceSchema>;

const emptyItem = () => ({
  productId: "",
  quantity: undefined as unknown as number,
  unitPrice: undefined as unknown as number,
  taxPercent: undefined,
});

const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export default function SaleInvoiceForm() {
  const navigate = useNavigate();
  const revalidate = useRevalidate();
  const customers = useSWR<Paginated<Customer>>(listPath("/customers", { pageSize: OPTIONS_PAGE_SIZE }));
  const products = useSWR<Paginated<Product>>(
    listPath("/products", { pageSize: OPTIONS_PAGE_SIZE, isActive: "true" })
  );

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(SaleInvoiceSchema),
    defaultValues: {
      saleCode: generateCode("INV"),
      customerId: "",
      saleDate: todayInput(),
      status: "Pending",
      discount: undefined,
      taxAmount: undefined,
      items: [emptyItem()],
    },
  });
  const { register, handleSubmit, control, watch, setValue, formState } = form;
  const { errors, isSubmitting } = formState;
  const items = useFieldArray({ control, name: "items" });

  const productById = useMemo(
    () => new Map(products.data?.data.map((p) => [p.id, p]) ?? []),
    [products.data]
  );

  const watched = watch();
  const lines = (watched.items ?? []).map((item) => ({ quantity: n(item.quantity), unitPrice: n(item.unitPrice) }));
  const subtotal = lines.reduce((sum, line) => sum + saleLineTotal(line), 0);
  const total = calculateSaleTotal({ items: lines, discount: n(watched.discount), taxAmount: n(watched.taxAmount) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post("/sales", values);
      toast.success("Invoice created");
      await revalidate("/sales", "/inventory", "/products", "/dashboard/stats", "/reports/sales");
      navigate("/sale-invoice");
    } catch (error) {
      // Stock-outs come back as 409 with the server's message naming the product.
      toast.error(errorMessage(error));
    }
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="New Invoice" description="Sell stock to a customer" />
      <form onSubmit={onSubmit} className="space-y-6" noValidate aria-label="Sale invoice">
        <Card>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
            <Field id="customerId" label="Customer" error={errors.customerId?.message}>
              <NativeSelect id="customerId" {...register("customerId")}>
                <option value="">Select a customer</option>
                {customers.data?.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="saleCode" label="Invoice code" error={errors.saleCode?.message}>
              <Input id="saleCode" {...register("saleCode")} />
            </Field>
            <Field id="saleDate" label="Invoice date" error={errors.saleDate?.message}>
              <Input id="saleDate" type="date" {...register("saleDate")} />
            </Field>
            <Field id="status" label="Status" error={errors.status?.message}>
              <NativeSelect id="status" {...register("status")}>
                {SaleStatus.map((s) => (
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
            {items.fields.map((field, index) => {
              const itemErrors = errors.items?.[index];
              const label = (name: string) => `${name} (item ${index + 1})`;
              const product = productById.get(watched.items?.[index]?.productId ?? "");
              const onHand = product?.inventory?.quantityOnHand ?? 0;
              const short = product && n(watched.items?.[index]?.quantity) > onHand;
              return (
                <div key={field.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-6" data-testid="sale-item">
                  <Field id={`items.${index}.productId`} label={label("Product")} error={itemErrors?.productId?.message} className="md:col-span-2">
                    <NativeSelect
                      id={`items.${index}.productId`}
                      {...register(`items.${index}.productId`, {
                        onChange: (event) => {
                          const picked = productById.get(event.target.value);
                          if (picked) setValue(`items.${index}.unitPrice`, picked.unitPrice);
                        },
                      })}
                    >
                      <option value="">Select a product</option>
                      {products.data?.data.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.inventory?.quantityOnHand ?? 0} in stock)
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field
                    id={`items.${index}.quantity`}
                    label={label("Quantity")}
                    error={itemErrors?.quantity?.message ?? (short ? `Only ${onHand} in stock` : undefined)}
                  >
                    <Input id={`items.${index}.quantity`} inputMode="numeric" {...register(`items.${index}.quantity`, { setValueAs: asNumber })} />
                  </Field>
                  <Field id={`items.${index}.unitPrice`} label={label("Unit price")} error={itemErrors?.unitPrice?.message}>
                    <Input id={`items.${index}.unitPrice`} inputMode="decimal" {...register(`items.${index}.unitPrice`, { setValueAs: asNumber })} />
                  </Field>
                  <Field id={`items.${index}.taxPercent`} label={label("Tax %")} error={itemErrors?.taxPercent?.message}>
                    <Input id={`items.${index}.taxPercent`} inputMode="decimal" {...register(`items.${index}.taxPercent`, { setValueAs: asNumber })} />
                  </Field>
                  <div className="flex items-end justify-between gap-2">
                    <div className="text-sm">
                      <div className="text-xs text-muted-foreground">Line total</div>
                      <div className="font-semibold" data-testid="line-total">
                        {formatCurrency(saleLineTotal(lines[index] ?? { quantity: 0, unitPrice: 0 }))}
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
            <Field id="taxAmount" label="Tax amount" error={errors.taxAmount?.message}>
              <Input id="taxAmount" inputMode="decimal" {...register("taxAmount", { setValueAs: asNumber })} />
            </Field>
            <div className="text-sm">
              <div className="text-muted-foreground">Subtotal</div>
              <div className="text-lg font-semibold" data-testid="subtotal">{formatCurrency(subtotal)}</div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground">Total</div>
              <div className="text-2xl font-bold" data-testid="grand-total">{formatCurrency(total)}</div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/sale-invoice">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Create invoice"}
          </Button>
        </div>
      </form>
    </div>
  );
}
