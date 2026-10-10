import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Loader2, Save } from "lucide-react";
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
  Textarea,
} from "@dms/ui";
import { api, failureMessage } from "../../lib/api";

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const editCompanySchema = z.object({
  name: z.string().trim().min(1, "Company name is required"),
  displayName: z.string().trim().optional(),
  address: z.string().trim().optional(),
  gstin: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || gstinRegex.test(val.toUpperCase()),
      "Enter a valid 15-character GSTIN (e.g. 27AABCU9603R1ZM)"
    ),
});

export type EditCompanyFormValues = z.infer<typeof editCompanySchema>;

export interface EditCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
  onSuccess?: () => void;
}

export function EditCompanyDialog({
  open,
  onOpenChange,
  organization,
  onSuccess,
}: EditCompanyDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  const form = useForm<EditCompanyFormValues>({
    resolver: zodResolver(editCompanySchema),
    defaultValues: {
      name: organization?.name ?? "",
      displayName: "",
      address: "",
      gstin: "",
    },
  });

  useEffect(() => {
    if (open && organization?.id) {
      form.reset({
        name: organization.name,
        displayName: "",
        address: "",
        gstin: "",
      });

      setLoadingSettings(true);
      api
        .get<{
          displayName?: string | null;
          address?: string | null;
          gstin?: string | null;
        }>("/settings")
        .then((settings) => {
          if (settings) {
            form.setValue("name", organization.name);

            if (settings.displayName) {
              form.setValue("displayName", settings.displayName);
            }

            if (settings.address) {
              form.setValue("address", settings.address);
            }

            if (settings.gstin) {
              form.setValue("gstin", settings.gstin);
            }
          }
        })
        .catch(() => {
          // Non-blocking: fallback to initial organization prop values
        })
        .finally(() => {
          setLoadingSettings(false);
        });
    }
  }, [open, organization?.id, organization?.name, form]);

  const onSubmit = async (values: EditCompanyFormValues) => {
    if (!organization?.id) return;
    setSubmitting(true);

    try {
      await api.patch(`/organizations/${organization.id}`, {
        name: values.name.trim(),
        displayName: values.displayName?.trim() || null,
        address: values.address?.trim() || null,
        gstin: values.gstin?.trim() ? values.gstin.trim().toUpperCase() : null,
      });

      toast.success("Company details updated successfully");
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      toast.error(failureMessage(err instanceof Error ? err : new Error(String(err)), "Failed to update company details"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Building2 className="size-5" />
            </div>
            <div>
              <DialogTitle>Edit Company Details</DialogTitle>
              <DialogDescription>
                Update your active company name, legal address, and GSTIN.
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
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Distribution Corp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name (on Documents)</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Distribution (Private Limited)" {...field} />
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
                  <FormLabel>GSTIN</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="27AABCU9603R1ZM"
                      className="font-mono uppercase"
                      maxLength={15}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
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
                  <FormLabel>Registered Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="123 Industrial Warehouse Zone, Sector 4..."
                      className="resize-none h-20"
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
              <Button type="submit" disabled={submitting || loadingSettings} className="gap-2">
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default EditCompanyDialog;
