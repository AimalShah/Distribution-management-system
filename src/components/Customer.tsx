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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";
import { createCustomer } from "@/actions/customer";
import {
  CustomerInput,
  CustomerOutput,
  CustomerSchema,
} from "@/validations/schemas";
import type { CustomerFormData as CustomerActionFormData } from "@/types/customer";
import { generateCode } from "@/lib/utils";
import { toast } from "sonner";
import { mutate } from "swr";
import { Plus } from "lucide-react";

export type CustomerFormData = CustomerOutput;

export function CustomerDialog() {
  const [open, setOpen] = useState(false);
  // The schema parses `creditLimit` into a number, so the inputs and the
  // parsed values are different types and the form is typed <input, context,
  // output>. No `context` is ever passed, so `unknown` is the honest type for
  // it. The `FormField`s below let `control` drive the generic inference.
  const form = useForm<CustomerInput, unknown, CustomerOutput>({
    resolver: zodResolver(CustomerSchema),
    defaultValues: {
      customerCode: "",
      name: "",
      email: undefined,
      phone: undefined,
      address: undefined,
      city: undefined,
      creditLimit: "",
      isActive: true,
    },
  });
  useEffect(() => {
    const code = generateCode("CUS");
    form.setValue("customerCode", code);
  });

  function onOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
  }

  async function onSubmit(data: CustomerOutput) {
    const payload: CustomerActionFormData = {
      customerCode: data.customerCode,
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      city: data.city,
      creditLimit: data.creditLimit,
      isActive: data.isActive,
    };
    const res = createCustomer(payload);
    return toast.promise(res, {
      loading: "Creating customer...",
      success: (response) => {
        mutate(() => true);
        onOpenChange(false);
        form.reset();
        return "Customer added successfully";
      },
      error: (err) => err?.response?.data?.message || "Failed to add customer",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
          <DialogDescription>
            Fill in customer details to add them to the system.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="customerCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Code</FormLabel>
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name" {...field} />
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
                      <Input placeholder="Enter phone" {...field} />
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
                    <Textarea placeholder="Enter address" {...field} />
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
              name="creditLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit Limit</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="mb-0">Active</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add Customer</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
