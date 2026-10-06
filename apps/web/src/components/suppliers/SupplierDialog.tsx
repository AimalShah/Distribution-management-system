import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SupplierSchema, type SupplierInput } from "@dms/shared";
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
import { generateSupplierCode } from "../../lib/code";

export interface SupplierRow {
  id: string;
  supplierCode: string;
  companyName: string;
  contactPerson: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  isActive: boolean;
  createdAt?: string;
  _count?: {
    purchase: number;
  };
}

export interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierRow | null;
  onSuccess: () => void;
}

export function SupplierDialog({
  open,
  onOpenChange,
  supplier,
  onSuccess,
}: SupplierDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(supplier);

  const form = useForm<any>({
    resolver: zodResolver(SupplierSchema),
    defaultValues: {
      supplierCode: generateSupplierCode(),
      companyName: "",
      contactPerson: "",
      email: null,
      phone: null,
      address: null,
      city: null,
      isActive: true,
    },
  });

  useEffect(() => {
    if (supplier) {
      form.reset({
        supplierCode: supplier.supplierCode,
        companyName: supplier.companyName,
        contactPerson: supplier.contactPerson,
        email: supplier.email ?? null,
        phone: supplier.phone ?? null,
        address: supplier.address ?? null,
        city: supplier.city ?? null,
        isActive: supplier.isActive ?? true,
      });
    } else {
      form.reset({
        supplierCode: generateSupplierCode(),
        companyName: "",
        contactPerson: "",
        email: null,
        phone: null,
        address: null,
        city: null,
        isActive: true,
      });
    }
  }, [supplier, form]);

  const onSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const payload = {
        supplierCode: values.supplierCode.trim(),
        companyName: values.companyName.trim(),
        contactPerson: values.contactPerson.trim(),
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        address: values.address?.trim() || null,
        city: values.city?.trim() || null,
        isActive: values.isActive,
      };

      if (isEditing && supplier) {
        await api.put(`/suppliers/${supplier.id}`, payload);
        toast.success("Supplier updated successfully");
      } else {
        await api.post("/suppliers", payload);
        toast.success("Supplier created successfully");
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to save supplier");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Supplier" : "New Supplier"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update vendor details, contact persons, or delivery locations."
              : "Register a verified wholesale vendor or product manufacturer."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplierCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="SUPP-XXXXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Apex Global Distributors" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Sarah Jenkins" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="orders@vendor.com"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+1-555-0155"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Dallas"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="500 Logistics Way, Bay 3"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={field.value ? "true" : "false"}
                    onValueChange={(val) => field.onChange(val === "true")}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
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
                {isEditing ? "Save Changes" : "Create Supplier"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
