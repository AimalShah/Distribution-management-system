import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  InventoryCreateSchema,
  type InventoryCreateInput,
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
import { AddInventoryForm } from "./AddInventoryForm";

export interface AddInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export function AddInventoryDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddInventoryDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [importMode, setImportMode] = useState<"manual" | "bulk">("manual");

  // Load products to select
  const { data: productsData } = useSWR("/products?page=1&pageSize=100", fetcher);
  const products: { id: string; name: string; productCode: string }[] =
    productsData?.data ?? [];

  const form = useForm<InventoryCreateInput>({
    resolver: zodResolver(InventoryCreateSchema),
    defaultValues: {
      productId: "",
      quantityOnHand: 0,
      reorderLevel: 10,
      maxStockLevel: 100,
      quantityReserved: 0,
    },
  });

  const onSubmit = async (values: InventoryCreateInput) => {
    setSubmitting(true);
    try {
      await api.post("/inventory", {
        productId: values.productId,
        quantityOnHand: Number(values.quantityOnHand),
        reorderLevel: values.reorderLevel !== undefined ? Number(values.reorderLevel) : undefined,
        maxStockLevel: values.maxStockLevel !== undefined ? Number(values.maxStockLevel) : undefined,
        quantityReserved: values.quantityReserved !== undefined ? Number(values.quantityReserved) : undefined,
      });
      toast.success("Inventory record created successfully");
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to create inventory record");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={importMode === "bulk" ? "sm:max-w-2xl max-h-[90vh] overflow-y-auto" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>Add Inventory Record</DialogTitle>
          <DialogDescription>
            Initialize stock tracking and reorder thresholds for a catalog product.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b pb-3 mb-2">
          <Button
            type="button"
            variant={importMode === "manual" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setImportMode("manual")}
          >
            Manual Entry
          </Button>
          <Button
            type="button"
            variant={importMode === "bulk" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setImportMode("bulk")}
          >
            Bulk CSV Import
          </Button>
        </div>

        {importMode === "bulk" ? (
          <AddInventoryForm
            onSuccess={() => {
              onSuccess();
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.productCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantityOnHand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Stock</FormLabel>
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
                name="reorderLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder Level</FormLabel>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="maxStockLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Stock Level</FormLabel>
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
                name="quantityReserved"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reserved Quantity</FormLabel>
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
            </div>

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
                Save Inventory
              </Button>
            </DialogFooter>
          </form>
        </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
