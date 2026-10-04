import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { CustomerSchema } from "@dms/shared";
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
import type { Customer } from "../../types/sale";

type FormInput = z.input<typeof CustomerSchema>;
type FormOutput = z.output<typeof CustomerSchema>;

const toForm = (customer?: Customer): FormInput => ({
  customerCode: customer?.customerCode ?? generateCode("CUST"),
  name: customer?.name ?? "",
  email: customer?.email ?? "",
  phone: customer?.phone ?? "",
  address: customer?.address ?? "",
  city: customer?.city ?? "",
  // A recorded 0 stays 0 ("no credit"); only a missing limit is blank.
  creditLimit: customer?.creditLimit ?? "",
  isActive: customer?.isActive ?? true,
});

/**
 * Add and edit share one dialog. Blank optional fields are sent as blanks and
 * the shared schema turns them into `null`, which is what clears a column on
 * edit -- the legacy update dropped empty strings and kept the old value.
 */
export function CustomerDialog({ customer, trigger }: { customer?: Customer; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const revalidate = useRevalidate();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(CustomerSchema),
    defaultValues: toForm(customer),
  });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;
  const { errors, isSubmitting } = formState;

  useEffect(() => {
    if (open) reset(toForm(customer));
  }, [open, customer, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (customer) {
        await api.put(`/customers/${customer.id}`, values);
        toast.success("Customer updated");
      } else {
        await api.post("/customers", values);
        toast.success("Customer added");
      }
      await revalidate("/customers", "/dashboard/stats");
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
          <DialogTitle>{customer ? `Edit ${customer.name}` : "Add customer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate aria-label="Customer">
          <Field id="customer-name" label="Name" error={errors.name?.message}>
            <Input id="customer-name" {...register("name")} />
          </Field>
          <Field id="customer-code" label="Customer code" error={errors.customerCode?.message}>
            <Input id="customer-code" {...register("customerCode")} />
          </Field>
          <Field id="customer-email" label="Email" error={errors.email?.message}>
            <Input id="customer-email" type="email" {...register("email")} />
          </Field>
          <Field id="customer-phone" label="Phone" error={errors.phone?.message}>
            <Input id="customer-phone" {...register("phone")} />
          </Field>
          <Field id="customer-address" label="Address" error={errors.address?.message}>
            <Input id="customer-address" {...register("address")} />
          </Field>
          <Field id="customer-city" label="City" error={errors.city?.message}>
            <Input id="customer-city" {...register("city")} />
          </Field>
          <Field id="customer-creditLimit" label="Credit limit" error={errors.creditLimit?.message}>
            <Input id="customer-creditLimit" inputMode="decimal" {...register("creditLimit")} />
          </Field>
          <div className="flex items-end gap-2 pb-2">
            <Switch
              id="customer-isActive"
              checked={watch("isActive")}
              onCheckedChange={(checked) => setValue("isActive", checked)}
            />
            <Label htmlFor="customer-isActive">Active</Label>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : customer ? "Save changes" : "Add customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
