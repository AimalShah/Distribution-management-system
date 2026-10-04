import { useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import useSWR from "swr";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { ReturnCreateSchema } from "@dms/shared";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@dms/ui";
import { PageHeader } from "../../components/layout/PageHeader";
import { Field } from "../../components/common/Field";
import { NativeSelect } from "../../components/common/NativeSelect";
import { listPath, type Paginated } from "../../hooks/use-paginated";
import { useRevalidate } from "../../hooks/use-revalidate";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/fetcher";
import { asNumber, generateCode, todayInput } from "../../lib/form-values";
import { OPTIONS_PAGE_SIZE, type Product } from "../../types/catalog";
import type { PurchaseDetail, PurchaseListRow } from "../../types/purchase";
import type { SaleListRow } from "../../types/sale";
import { RETURN_TYPES, type ReturnableLine } from "../../types/returns";

type FormInput = z.input<typeof ReturnCreateSchema>;
type FormOutput = z.output<typeof ReturnCreateSchema>;

interface SaleDetail {
  items: { productId: string; quantity: number; unitPrice: number; product: ReturnableLine["product"] }[];
}

/** An unselected reference is absent, not "": the schema forbids the wrong one being present at all. */
const optionalId = (value: unknown) => (value === "" ? undefined : value);

const emptyItem = () => ({
  productId: "",
  quantity: undefined as unknown as number,
  unitPrice: undefined as unknown as number,
  taxAmount: 0,
  discount: 0,
  note: "",
});

export default function ReturnForm() {
  const navigate = useNavigate();
  const revalidate = useRevalidate();

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(ReturnCreateSchema),
    defaultValues: {
      returnCode: generateCode("RET"),
      returnType: "SALE",
      returnDate: todayInput(),
      reason: "",
      items: [emptyItem()],
    },
  });
  const { register, handleSubmit, control, watch, setValue, formState } = form;
  const { errors, isSubmitting } = formState;
  const items = useFieldArray({ control, name: "items" });

  const returnType = watch("returnType");
  const saleId = watch("saleId");
  const purchaseId = watch("purchaseId");

  const sales = useSWR<Paginated<SaleListRow>>(
    returnType === "SALE" ? listPath("/sales", { pageSize: OPTIONS_PAGE_SIZE }) : null
  );
  const purchases = useSWR<Paginated<PurchaseListRow>>(
    returnType === "PURCHASE" ? listPath("/purchases", { pageSize: OPTIONS_PAGE_SIZE }) : null
  );
  const sale = useSWR<SaleDetail>(returnType === "SALE" && saleId ? `/sales/${saleId}` : null);
  const purchase = useSWR<PurchaseDetail>(returnType === "PURCHASE" && purchaseId ? `/purchases/${purchaseId}` : null);
  const products = useSWR<Paginated<Product>>(listPath("/products", { pageSize: OPTIONS_PAGE_SIZE }));

  /**
   * What can be returned. Against a sale or purchase, only that document's
   * lines, at the price it was transacted at and up to the quantity on it --
   * a return of something the customer never bought is not a return. A
   * write-off can name any product, valued at cost.
   */
  const returnable: ReturnableLine[] = useMemo(() => {
    if (returnType === "SALE") {
      return (sale.data?.items ?? []).map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.unitPrice, product: i.product }));
    }
    if (returnType === "PURCHASE") {
      return (purchase.data?.purchaseItems ?? []).map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        price: i.unitCost,
        product: i.product,
      }));
    }
    return (products.data?.data ?? []).map((p) => ({
      productId: p.id,
      quantity: Number.POSITIVE_INFINITY,
      price: p.unitCost,
      product: { id: p.id, name: p.name, productCode: p.productCode },
    }));
  }, [returnType, sale.data, purchase.data, products.data]);

  const byProduct = useMemo(() => new Map(returnable.map((l) => [l.productId, l])), [returnable]);
  const needsDocument = (returnType === "SALE" && !saleId) || (returnType === "PURCHASE" && !purchaseId);
  const effect = RETURN_TYPES.find((t) => t.value === returnType)?.effect;

  /** Lines picked against one document mean nothing against another. */
  const resetLines = () => items.replace([emptyItem()]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post("/returns", values);
      toast.success("Return recorded");
      await revalidate("/returns", "/inventory", "/dashboard/stats");
      navigate("/returns");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="New Return" description="Record goods coming back or being written off" />
      <form onSubmit={onSubmit} className="space-y-6" noValidate aria-label="Return">
        <Card>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
            <Field id="returnType" label="Return type" error={errors.returnType?.message}>
              <NativeSelect
                id="returnType"
                {...register("returnType", {
                  onChange: () => {
                    setValue("saleId", undefined);
                    setValue("purchaseId", undefined);
                    resetLines();
                  },
                })}
              >
                {RETURN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground" data-testid="return-effect">
                {effect}
              </p>
            </Field>

            {returnType === "SALE" && (
              <Field id="saleId" label="Sale" error={errors.saleId?.message}>
                <NativeSelect id="saleId" {...register("saleId", { setValueAs: optionalId, onChange: resetLines })}>
                  <option value="">Select a sale</option>
                  {sales.data?.data.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.saleCode} — {s.customer.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {returnType === "PURCHASE" && (
              <Field id="purchaseId" label="Purchase" error={errors.purchaseId?.message}>
                <NativeSelect id="purchaseId" {...register("purchaseId", { setValueAs: optionalId, onChange: resetLines })}>
                  <option value="">Select a purchase</option>
                  {purchases.data?.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.purchaseCode} — {p.supplier.companyName}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}

            <Field id="returnCode" label="Return code" error={errors.returnCode?.message}>
              <Input id="returnCode" {...register("returnCode")} />
            </Field>
            <Field id="returnDate" label="Return date" error={errors.returnDate?.message}>
              <Input id="returnDate" type="date" {...register("returnDate")} />
            </Field>
            <Field id="reason" label="Reason" className="md:col-span-4">
              <Input id="reason" {...register("reason")} />
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
            {needsDocument && (
              <p className="text-sm text-muted-foreground">
                Select the {returnType === "SALE" ? "sale" : "purchase"} first; its lines are what can be returned.
              </p>
            )}
            {items.fields.map((field, index) => {
              const itemErrors = errors.items?.[index];
              const label = (name: string) => `${name} (item ${index + 1})`;
              const line = byProduct.get(watch(`items.${index}.productId`) ?? "");
              const tooMany = line && Number(watch(`items.${index}.quantity`)) > line.quantity;
              return (
                <div key={field.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-7" data-testid="return-item">
                  <Field id={`items.${index}.productId`} label={label("Product")} error={itemErrors?.productId?.message} className="md:col-span-2">
                    <NativeSelect
                      id={`items.${index}.productId`}
                      disabled={needsDocument}
                      {...register(`items.${index}.productId`, {
                        onChange: (event) => {
                          const picked = byProduct.get(event.target.value);
                          if (picked) setValue(`items.${index}.unitPrice`, picked.price);
                        },
                      })}
                    >
                      <option value="">Select a product</option>
                      {returnable.map((l) => (
                        <option key={l.productId} value={l.productId}>
                          {l.product.name}
                          {Number.isFinite(l.quantity) ? ` (${l.quantity} on document)` : ""}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field
                    id={`items.${index}.quantity`}
                    label={label("Quantity")}
                    error={itemErrors?.quantity?.message ?? (tooMany ? `Only ${line.quantity} on the document` : undefined)}
                  >
                    <Input id={`items.${index}.quantity`} inputMode="numeric" {...register(`items.${index}.quantity`, { setValueAs: asNumber })} />
                  </Field>
                  <Field id={`items.${index}.unitPrice`} label={label("Unit price")} error={itemErrors?.unitPrice?.message}>
                    <Input id={`items.${index}.unitPrice`} inputMode="decimal" {...register(`items.${index}.unitPrice`, { setValueAs: asNumber })} />
                  </Field>
                  <Field id={`items.${index}.taxAmount`} label={label("Tax")} error={itemErrors?.taxAmount?.message}>
                    <Input id={`items.${index}.taxAmount`} inputMode="decimal" {...register(`items.${index}.taxAmount`, { setValueAs: asNumber })} />
                  </Field>
                  <Field id={`items.${index}.discount`} label={label("Discount")} error={itemErrors?.discount?.message}>
                    <Input id={`items.${index}.discount`} inputMode="decimal" {...register(`items.${index}.discount`, { setValueAs: asNumber })} />
                  </Field>
                  <div className="flex items-end justify-end">
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

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/returns">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Record return"}
          </Button>
        </div>
      </form>
    </div>
  );
}
