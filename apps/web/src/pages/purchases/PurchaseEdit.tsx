import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import useSWR from "swr";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PurchaseUpdateSchema } from "@dms/shared";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton } from "@dms/ui";
import { PageHeader } from "../../components/layout/PageHeader";
import { QueryError } from "../../components/layout/QueryError";
import { Field } from "../../components/common/Field";
import { NativeSelect } from "../../components/common/NativeSelect";
import { listPath, type Paginated } from "../../hooks/use-paginated";
import { useRevalidate } from "../../hooks/use-revalidate";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/fetcher";
import { asNumber, toDateInput } from "../../lib/form-values";
import { formatCurrency, formatDate } from "../../lib/format";
import { OPTIONS_PAGE_SIZE } from "../../types/catalog";
import { PURCHASE_STATUSES, type PurchaseDetail, type Supplier } from "../../types/purchase";

type FormInput = z.input<typeof PurchaseUpdateSchema>;
type FormOutput = z.output<typeof PurchaseUpdateSchema>;

/**
 * Header fields only. `PurchaseUpdateSchema` omits `items` on purpose: changing
 * a received line without replaying its stock movement would put inventory out
 * of step with the document. A wrong line is corrected by deleting the purchase
 * (which reverses its stock) and recording it again.
 */
export default function PurchaseEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const revalidate = useRevalidate();
  const purchase = useSWR<PurchaseDetail>(`/purchases/${id}`);
  const suppliers = useSWR<Paginated<Supplier>>(listPath("/suppliers", { pageSize: OPTIONS_PAGE_SIZE }));

  const form = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(PurchaseUpdateSchema) });
  const { register, handleSubmit, reset, setValue, getValues, formState } = form;
  const { errors, isSubmitting } = formState;

  useEffect(() => {
    if (!purchase.data) return;
    reset({
      supplierId: purchase.data.supplierId,
      purchaseCode: purchase.data.purchaseCode,
      purchaseDate: toDateInput(purchase.data.purchaseDate),
      status: purchase.data.status,
      discount: purchase.data.discount ?? undefined,
      taxAmount: purchase.data.taxAmount ?? undefined,
    });
  }, [purchase.data, reset]);

  // See ProductForm: re-apply once the supplier options exist.
  useEffect(() => {
    const current = getValues("supplierId");
    if (suppliers.data && current) setValue("supplierId", current);
  }, [suppliers.data, getValues, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.put(`/purchases/${id}`, values);
      toast.success("Purchase updated");
      await revalidate("/purchases", "/dashboard/stats");
      navigate("/purchase");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  if (purchase.error) return <QueryError error={purchase.error} onRetry={() => purchase.mutate()} />;
  if (!purchase.data) return <Skeleton className="h-96" data-testid="form-skeleton" />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={`Edit ${purchase.data.purchaseCode}`} description={purchase.data.supplier.companyName} />
      <form onSubmit={onSubmit} noValidate aria-label="Purchase">
        <Card>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
            <Field id="supplierId" label="Supplier" error={errors.supplierId?.message}>
              <NativeSelect id="supplierId" {...register("supplierId")}>
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
            <Field id="discount" label="Discount" error={errors.discount?.message}>
              <Input id="discount" inputMode="decimal" {...register("discount", { setValueAs: asNumber })} />
            </Field>
            <Field id="taxAmount" label="Additional tax" error={errors.taxAmount?.message}>
              <Input id="taxAmount" inputMode="decimal" {...register("taxAmount", { setValueAs: asNumber })} />
            </Field>
            <div className="flex justify-end gap-2 md:col-span-3">
              <Button type="button" variant="outline" asChild>
                <Link to="/purchase">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <p className="text-sm text-muted-foreground">
            Received lines cannot be edited. Delete the purchase to reverse its stock, then record it again.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="divide-y" data-testid="purchase-lines">
            {purchase.data.purchaseItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {item.product.name} × {item.quantity}
                  {item.batchNumber && <span className="text-muted-foreground"> · batch {item.batchNumber}</span>}
                  {item.expiryDate && <span className="text-muted-foreground"> · expires {formatDate(item.expiryDate)}</span>}
                </span>
                <span className="font-medium">{formatCurrency(item.totalCost)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-right text-lg font-semibold">
            Total {formatCurrency(purchase.data.totalAmount)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
