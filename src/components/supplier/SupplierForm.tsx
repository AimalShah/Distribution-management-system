"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect } from "react";
import { generateCode } from "@/lib/utils";
import { createSupplier } from "@/actions/supplier";
import { toast } from "sonner";
import {
  SupplierInput,
  SupplierOutput,
  SupplierSchema,
} from "@/validations/schemas";
import type { SupplierFormData } from "@/types/supplier";
import { Plus } from "lucide-react";

export function SupplierDialog() {
  // The schema defaults `isActive`, so the inputs and the parsed values are
  // different types and the form is typed <input, context, output>. No
  // `context` is ever passed, so `unknown` is the honest type for it. The
  // `FormField`s below let `control` drive the generic inference.
  const form = useForm<SupplierInput, unknown, SupplierOutput>({
    resolver: zodResolver(SupplierSchema),
    defaultValues: {
      supplierCode: "",
      companyName: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      isActive: true,
    },
  });

  useEffect(() => {
    const code = generateCode("SUP");
    form.setValue("supplierCode", code);
  });
  async function onSubmit(values: SupplierOutput) {
    const payload: SupplierFormData = {
      supplierCode: values.supplierCode,
      companyName: values.companyName,
      contactPerson: values.contactPerson,
      email: values.email,
      phone: values.phone,
      address: values.address,
      city: values.city,
      isActive: values.isActive,
    };
    const res = createSupplier(payload);
    return toast.promise(res, {
      loading: "Creating supplier...",
      success: (response) => {
        form.reset();
        return "Supplier created successfully";
      },
      error: (err) =>
        err?.response?.data?.message || "Failed to create supplier",
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Supplier</DialogTitle>
          <DialogDescription>
            Add a new supplier to your database. Fill in all the required
            information.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="supplierCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter unique code"
                      {...field}
                      disabled
                    />
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
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Person</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter contact person name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} />
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
                    <Textarea placeholder="Enter full address" {...field} />
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
                    <Input placeholder="Enter city" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active Supplier</FormLabel>
                    <FormDescription>
                      Keep this checked if the supplier is currently active.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">Add Supplier</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
