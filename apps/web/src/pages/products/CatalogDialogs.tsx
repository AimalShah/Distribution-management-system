import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { BrandSchema, CategorySchema } from "@dms/shared";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@dms/ui";
import { Field } from "../../components/common/Field";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/fetcher";
import { useRevalidate } from "../../hooks/use-revalidate";
import type { Brand, Category } from "../../types/catalog";

type CategoryForm = z.input<typeof CategorySchema>;
type BrandForm = z.input<typeof BrandSchema>;

/**
 * Quick-create from the product form. The legacy put these on the product page
 * as separate cards; here they open from the field that needs them, and the
 * new row is selected on success.
 */
export function NewCategoryDialog({ onCreated }: { onCreated: (category: Category) => void }) {
  const [open, setOpen] = useState(false);
  const revalidate = useRevalidate();
  const form = useForm<CategoryForm, unknown, z.output<typeof CategorySchema>>({
    resolver: zodResolver(CategorySchema),
    defaultValues: { name: "", description: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      const { data } = await api.post<Category>("/categories", values);
      toast.success("Category created");
      await revalidate("/categories");
      onCreated(data);
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="mr-1 h-3 w-3" /> New category
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
        </DialogHeader>
        {/* Not nested in the product <form>: the dialog renders in a portal,
            but a submit here must never submit the product. */}
        <div className="space-y-4">
          <Field id="category-name" label="Category name" error={form.formState.errors.name?.message}>
            <Input id="category-name" {...form.register("name")} />
          </Field>
          <Field id="category-description" label="Description">
            <Input id="category-description" {...form.register("description")} />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" onClick={submit} disabled={form.formState.isSubmitting}>
            Create category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewBrandDialog({
  categoryId,
  onCreated,
}: {
  categoryId: string;
  onCreated: (brand: Brand) => void;
}) {
  const [open, setOpen] = useState(false);
  const revalidate = useRevalidate();
  const form = useForm<BrandForm, unknown, z.output<typeof BrandSchema>>({
    resolver: zodResolver(BrandSchema),
    values: { name: "", categoryId, description: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      const { data } = await api.post<Brand>("/brands", values);
      toast.success("Brand created");
      await revalidate("/brands");
      onCreated(data);
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={!categoryId}>
          <Plus className="mr-1 h-3 w-3" /> New brand
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New brand</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field id="brand-name" label="Brand name" error={form.formState.errors.name?.message}>
            <Input id="brand-name" {...form.register("name")} />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" onClick={submit} disabled={form.formState.isSubmitting}>
            Create brand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
