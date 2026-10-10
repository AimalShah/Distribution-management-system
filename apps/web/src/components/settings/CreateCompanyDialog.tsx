import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
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
} from "@dms/ui";
import { api, failureMessage } from "../../lib/api";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Company name is required"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and single hyphens, e.g. acme-distribution"
    ),
  address: z.string().trim().optional(),
  gstin: z.string().trim().optional(),
});

export type CreateCompanyFormValues = z.infer<typeof createCompanySchema>;

export interface CreatedCompany {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  gstin?: string | null;
  createdAt: string;
}

export interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (company: CreatedCompany) => void;
  autoActivate?: boolean;
}

export function CreateCompanyDialog({
  open,
  onOpenChange,
  onSuccess,
  autoActivate = true,
}: CreateCompanyDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateCompanyFormValues>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      name: "",
      slug: "",
      address: "",
      gstin: "",
    },
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    form.setValue("name", value, { shouldValidate: true });
    // Only auto-update slug if untouched or currently matching slugified previous value
    form.setValue("slug", toSlug(value), { shouldValidate: true });
  };

  const onSubmit = async (values: CreateCompanyFormValues) => {
    setSubmitting(true);

    try {
      const created = await api.post<CreatedCompany>("/organizations", {
        name: values.name,
        slug: values.slug || toSlug(values.name),
        address: values.address?.trim() || undefined,
        gstin: values.gstin?.trim() || undefined,
      });

      if (autoActivate && created.id) {
        await api.post("/organizations/set-active", { organizationId: created.id });
      }

      toast.success("Company created successfully");
      form.reset();
      onOpenChange(false);
      onSuccess?.(created);
    } catch (err: unknown) {
      toast.error(failureMessage(err instanceof Error ? err : new Error(String(err)), "Failed to create company"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <div>
              <DialogTitle>Create Company</DialogTitle>
              <DialogDescription>
                Register a new company entity for isolated operations and inventory.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Paramount Foods & Beverages"
                      {...field}
                      onChange={handleNameChange}
                      disabled={submitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Identifier (Slug)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. paramount-foods"
                      {...field}
                      disabled={submitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 12 Commerce Road, Suite 4"
                      {...field}
                      disabled={submitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gstin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GSTIN (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 27AAPFU0939F1ZV"
                      {...field}
                      disabled={submitting}
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
                Create Company
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
