import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { InventoryAdjustSchema, InventoryCreateSchema } from "@dms/shared";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@dms/ui";
import { Field } from "../../components/common/Field";
import { NativeSelect } from "../../components/common/NativeSelect";
import { listPath, type Paginated } from "../../hooks/use-paginated";
import { useRevalidate } from "../../hooks/use-revalidate";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/fetcher";
import { asNumber } from "../../lib/form-values";
import { OPTIONS_PAGE_SIZE, type Product } from "../../types/catalog";
import { ADJUSTABLE_MOVEMENTS, type InventoryRow } from "../../types/inventory";

const REVALIDATE = ["/inventory", "/products", "/dashboard/stats"];

type AddInput = z.input<typeof InventoryCreateSchema>;
type AddOutput = z.output<typeof InventoryCreateSchema>;

/**
 * Start tracking stock for a product.
 *
 * The legacy form was built against fields the model does not have (the gap
 * analysis finding this checkpoint names); this one is `InventoryCreateSchema`
 * field for field. Products that already have an inventory row are left out of
 * the picker -- there is one row per product, and the server would refuse a
 * second.
 */
export function AddInventoryDialog() {
  const [open, setOpen] = useState(false);
  const revalidate = useRevalidate();
  const products = useSWR<Paginated<Product>>(
    open ? listPath("/products", { pageSize: OPTIONS_PAGE_SIZE, isActive: "true" }) : null
  );
  const untracked = products.data?.data.filter((p) => !p.inventory) ?? [];

  const form = useForm<AddInput, unknown, AddOutput>({
    resolver: zodResolver(InventoryCreateSchema),
    defaultValues: { productId: "", quantityOnHand: undefined as unknown as number },
  });
  const { register, handleSubmit, reset, formState } = form;
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post("/inventory", values);
      toast.success("Inventory added");
      await revalidate(...REVALIDATE);
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Add Inventory
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add inventory</DialogTitle>
          <DialogDescription>Start tracking stock for a product.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate aria-label="Add inventory">
          <Field id="add-productId" label="Product" error={errors.productId?.message}>
            <NativeSelect id="add-productId" {...register("productId")}>
              <option value="">Select a product</option>
              {untracked.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.productCode})
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="add-quantityOnHand" label="Quantity on hand" error={errors.quantityOnHand?.message}>
              <Input id="add-quantityOnHand" inputMode="numeric" {...register("quantityOnHand", { setValueAs: asNumber })} />
            </Field>
            <Field id="add-reorderLevel" label="Reorder level" error={errors.reorderLevel?.message}>
              <Input id="add-reorderLevel" inputMode="numeric" {...register("reorderLevel", { setValueAs: asNumber })} />
            </Field>
            <Field id="add-maxStockLevel" label="Maximum stock level" error={errors.maxStockLevel?.message}>
              <Input id="add-maxStockLevel" inputMode="numeric" {...register("maxStockLevel", { setValueAs: asNumber })} />
            </Field>
            <Field id="add-quantityReserved" label="Reserved" error={errors.quantityReserved?.message}>
              <Input id="add-quantityReserved" inputMode="numeric" {...register("quantityReserved", { setValueAs: asNumber })} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Add inventory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type AdjustInput = z.input<typeof InventoryAdjustSchema>;
type AdjustOutput = z.output<typeof InventoryAdjustSchema>;

export function AdjustInventoryDialog({ item }: { item: InventoryRow }) {
  const [open, setOpen] = useState(false);
  const revalidate = useRevalidate();
  const form = useForm<AdjustInput, unknown, AdjustOutput>({
    resolver: zodResolver(InventoryAdjustSchema),
    defaultValues: {
      inventoryId: item.id,
      movementType: "IN",
      quantity: undefined as unknown as number,
      reason: "",
    },
  });
  const { register, handleSubmit, reset, watch, formState } = form;
  const { errors, isSubmitting } = formState;
  const isCount = watch("movementType") === "ADJUSTMENT";

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post("/inventory/adjust", values);
      toast.success("Stock updated");
      await revalidate(...REVALIDATE);
      reset();
      setOpen(false);
    } catch (error) {
      // An OUT larger than the stock on hand comes back as a 409 naming both.
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Adjust ${item.product.name}`}>
          Adjust
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {item.product.name}</DialogTitle>
          <DialogDescription>
            {item.quantityOnHand} {item.product.unit} on hand
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate aria-label="Adjust inventory">
          <Field id="adjust-movementType" label="Movement" error={errors.movementType?.message}>
            <NativeSelect id="adjust-movementType" {...register("movementType")}>
              {ADJUSTABLE_MOVEMENTS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            id="adjust-quantity"
            label={isCount ? "Counted quantity" : "Quantity"}
            error={errors.quantity?.message}
          >
            <Input id="adjust-quantity" inputMode="numeric" {...register("quantity", { setValueAs: asNumber })} />
          </Field>
          <Field id="adjust-reason" label="Reason" error={errors.reason?.message}>
            <Input id="adjust-reason" {...register("reason")} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
