import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api";
import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@dms/ui";

/**
 * A slug: lowercase, numbers, hyphens only, no leading/trailing hyphens.
 * Mirrors the server's slugPattern.
 */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const createOrgSchema = z.object({
  displayName: z.string().trim().min(1, "Company name is required"),
  slug: z.string().trim().min(1, "Slug is required").regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens, e.g. acme-distribution"
  ),
  address: z.string().trim().optional(),
  gstin: z.string().trim().optional(),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

export interface Organization {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  gstin?: string | null;
  createdAt: string;
}

export interface OnboardingProps {
  /** Called after the active organization is set on the session. */
  onComplete?: () => void;
}

/**
 * The onboarding page (issue #42).
 *
 * A user with no active Company lands here after a 400 ORGANIZATION_REQUIRED.
 * The page lists their existing organizations and offers to create one.
 * Creating an organization posts to POST /api/organizations and then calls
 * the set-active endpoint so the session picks it up immediately.
 */
export function OnboardingPage({ onComplete }: OnboardingProps) {
  const navigate = useNavigate();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateOrgInput>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      displayName: "",
      address: "",
      gstin: "",
    },
  });

  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.get("/organizations");
      setOrganizations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your companies");
    } finally {
      setLoading(false);
    }
  };

  const submitCreate = async (values: CreateOrgInput) => {
    setCreating(true);
    setError(null);

    try {
      const created = await api.post<Organization>("/organizations", {
        name: values.displayName,
        slug: values.slug || toSlug(values.displayName),
        address: values.address,
        gstin: values.gstin,
      });

      // Activate the new organization on the session
      await api.post("/organizations/set-active", { organizationId: created.id });

      toast.success("Company created and activated");

      if (onComplete) {
        onComplete();
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the company");
    } finally {
      setCreating(false);
    }
  };

  const selectOrganization = async (organizationId: string) => {
    try {
      await api.post("/organizations/set-active", { organizationId });
      toast.success("Company switched");

      if (onComplete) {
        onComplete();
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch the company");
    }
  };

  const handleTabChange = (value: string) => {
    if (value === "list" || value === "create") {
      setActiveTab(value);
    }
  };

  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You need an active Company to continue. Pick one or create a new one.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="bg-muted/40 p-1 rounded-xl">
            <TabsTrigger value="list" className="gap-2 rounded-lg text-xs font-medium">
              <Building2 className="size-4" />
              Choose existing
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2 rounded-lg text-xs font-medium">
              <Plus className="size-4" />
              Create new
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Choose existing */}
          <TabsContent value="list" className="space-y-4">
            {loading ? (
              <div role="status" aria-label="Loading companies" className="space-y-3">
                <span className="sr-only">Loading your companies</span>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : organizations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="size-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium">No companies yet</p>
                <p className="text-xs mt-0.5">Create your first Company on the other tab.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {organizations.map((organization) => (
                  <Button
                    key={organization.id}
                    variant="outline"
                    className="w-full justify-start gap-3 text-left py-3"
                    onClick={() => selectOrganization(organization.id)}
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {organization.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-foreground">{organization.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(organization.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Create new */}
          <TabsContent value="create" className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(submitCreate)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Acme Distribution"
                          {...field}
                          onChange={(event) => {
                            field.onChange(event);

                            // Auto-generate slug from display name unless user typed one
                            if (!form.watch("slug")) {
                              form.setValue("slug", toSlug(event.target.value), {
                                shouldValidate: true,
                              });
                            }
                          }}
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
                      <FormLabel>Slug *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. acme-distribution"
                          {...field}
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
                      <FormLabel>Address (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. 12 Market Road"
                          {...field}
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
                      <FormLabel>GSTIN (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. 27AAPFU0939F1ZV"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {error && !creating && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full mt-2 cursor-pointer shadow-sm transition-all"
                  disabled={creating}
                >
                  {creating ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Create Company"
            )}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default OnboardingPage;