import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { SupplierSchema } from "@dms/shared";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Switch,
} from "@dms/ui";
import { Field } from "../../components/common/Field";
import { useRevalidate } from "../../hooks/use-revalidate";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/fetcher";
import { generateCode } from "../../lib/form-values";
import type { Supplier } from "../../types/purchase";

type FormInput = z.input<typeof SupplierSchema>;
type FormOutput = z.output<typeof SupplierSchema>;

const toForm = (supplier?: Supplier): FormInput => ({
  supplierCode: supplier?.supplierCode ?? generateCode("SUP"),
  companyName: supplier?.companyName ?? "",
  contactPerson: supplier?.contactPerson ?? "",
  email: supplier?.email ?? "",
  phone: supplier?.phone ?? "",
  address: supplier?.address ?? "",
  city: supplier?.city ?? "",
  isActive: supplier?.isActive ?? true,
});

/** Add and edit, one dialog. See `CustomerDialog` for how blanks are handled. */
export function SupplierDialog({ supplier, trigger }: { supplier?: Supplier; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const revalidate = useRevalidate();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(SupplierSchema),
    defaultValues: toForm(supplier),
  });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;
  const { errors, isSubmitting } = formState;

  useEffect(() => {
    if (open) reset(toForm(supplier));
  }, [open, supplier, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (supplier) {
        await api.put(`/suppliers/${supplier.id}`, values);
        toast.success("Supplier updated");
      } else {
        await api.post("/suppliers", values);
        toast.success("Supplier added");
      }
      await revalidate("/suppliers");
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{supplier ? `Edit ${supplier.companyName}` : "Add supplier"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate aria-label="Supplier">
          <Field id="supplier-companyName" label="Company name" error={errors.companyName?.message}>
            <Input id="supplier-companyName" {...register("companyName")} />
          </Field>
          <Field id="supplier-code" label="Supplier code" error={errors.supplierCode?.message}>
            <Input id="supplier-code" {...register("supplierCode")} />
          </Field>
          <Field id="supplier-contactPerson" label="Contact person" error={errors.contactPerson?.message}>
            <Input id="supplier-contactPerson" {...register("contactPerson")} />
          </Field>
          <Field id="supplier-email" label="Email" error={errors.email?.message}>
            <Input id="supplier-email" type="email" {...register("email")} />
          </Field>
          <Field id="supplier-phone" label="Phone" error={errors.phone?.message}>
            <Input id="supplier-phone" {...register("phone")} />
          </Field>
          <Field id="supplier-city" label="City" error={errors.city?.message}>
            <Input id="supplier-city" {...register("city")} />
          </Field>
          <Field id="supplier-address" label="Address" error={errors.address?.message} className="sm:col-span-2">
            <Input id="supplier-address" {...register("address")} />
          </Field>
          <div className="flex items-center gap-2">
            <Switch
              id="supplier-isActive"
              checked={watch("isActive")}
              onCheckedChange={(checked) => setValue("isActive", checked)}
            />
            <Label htmlFor="supplier-isActive">Active</Label>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : supplier ? "Save changes" : "Add supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
