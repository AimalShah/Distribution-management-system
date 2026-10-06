import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  InventoryAdjustSchema,
  InventoryMovementValues,
  type InventoryAdjustInput,
} from "@dms/shared";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dms/ui";
import { api } from "../../lib/api";

export interface InventoryItemSummary {
  id: string;
  quantityOnHand: number;
  product?: {
    id?: string;
    name: string;
    productCode?: string;
  } | null;
}

export interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryItem: InventoryItemSummary | null;
  onSuccess: () => void;
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  inventoryItem,
  onSuccess,
}: AdjustStockDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<InventoryAdjustInput>({
    resolver: zodResolver(InventoryAdjustSchema),
    defaultValues: {
      inventoryId: inventoryItem?.id ?? "",
      movementType: "IN",
      quantity: 1,
      reason: "",
    },
  });

  useEffect(() => {
    if (inventoryItem) {
      form.reset({
        inventoryId: inventoryItem.id,
        movementType: "IN",
        quantity: 1,
        reason: "",
      });
    }
  }, [inventoryItem, form]);

  const onSubmit = async (values: InventoryAdjustInput) => {
    setSubmitting(true);
    try {
      await api.post("/inventory/adjust", {
        inventoryId: values.inventoryId,
        movementType: values.movementType,
        quantity: Number(values.quantity),
        reason: values.reason.trim(),
      });
      toast.success("Inventory adjusted successfully");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to adjust inventory");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            {inventoryItem ? (
              <span>
                Product: <strong className="text-foreground">{inventoryItem.product?.name}</strong>{" "}
                (Current on hand: {inventoryItem.quantityOnHand})
              </span>
            ) : (
              "Record a manual stock movement or physical count adjustment."
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <input type="hidden" {...form.register("inventoryId")} />

            <FormField
              control={form.control}
              name="movementType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Movement Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select movement type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {InventoryMovementValues.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type === "IN" && "Add Stock (IN)"}
                          {type === "OUT" && "Remove Stock (OUT)"}
                          {type === "ADJUSTMENT" && "Physical Count Set (ADJUSTMENT)"}
                          {type === "RETURN" && "Return Stock (RETURN)"}
                          {type === "DAMAGED" && "Damaged Write-off (DAMAGED)"}
                          {type === "EXPIRED" && "Expired Write-off (EXPIRED)"}
                          {type === "TRANSFER" && "Stock Transfer (TRANSFER)"}
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
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason / Note</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Physical inventory reconciliation"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
                Confirm Adjustment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
