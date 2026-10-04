import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useNavigate } from "react-router-dom";
import { organizationCreateSchema, type OrganizationCreateInput } from "@dms/shared";
import { Button, Input, Label } from "@dms/ui";
import { authClient } from "../../lib/auth-client";
import { useAuth } from "../../hooks/use-auth";
import { FullPageSpinner } from "../../components/layout/FullPageSpinner";
import { AuthCard, FieldError } from "./AuthCard";

const toSlug = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Onboarding: a signed-in user with no organization creates their company.
 *
 * The legacy form sent the free-text company name into `slug`, which then had
 * to be unique across the whole install; the slug is now derived from the name
 * and editable, and `organizationCreateSchema` holds it to a slug's shape.
 */
export default function RegisterCompany() {
  const navigate = useNavigate();
  const { data: session, isPending } = useAuth();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<OrganizationCreateInput>({
    resolver: zodResolver(organizationCreateSchema),
    defaultValues: { name: "", slug: "" },
  });

  if (isPending) return <FullPageSpinner />;
  if (!session) return <Navigate to="/login" replace />;

  const onSubmit = async (values: OrganizationCreateInput) => {
    setFormError(undefined);
    const { data, error } = await authClient.organization.create(values);
    if (error || !data) {
      setFormError(error?.message ?? "Could not create the organization.");
      return;
    }
    // Explicit, so the cached session picks up the new active organization
    // before `RequireAuth` reads it.
    await authClient.organization.setActive({ organizationId: data.id });
    navigate("/dashboard", { replace: true });
  };

  const name = register("name", {
    onChange: (event) => {
      if (!dirtyFields.slug) setValue("slug", toSlug(event.target.value));
    },
  });

  return (
    <AuthCard title="Register your company" description="Create the organization your team will work in.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">Company name</Label>
          <Input id="name" {...name} />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Company URL name</Label>
          <Input id="slug" {...register("slug")} />
          <FieldError message={errors.slug?.message} />
        </div>
        <FieldError message={formError} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create organization"}
        </Button>
      </form>
    </AuthCard>
  );
}
