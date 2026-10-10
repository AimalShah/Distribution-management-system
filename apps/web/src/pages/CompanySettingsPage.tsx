import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Settings2,
  Tags,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@dms/ui";
import { useForm } from "react-hook-form";
import { api, failureMessage } from "../lib/api";
import { SkuFormatBuilder } from "../components/settings/SkuFormatBuilder";
import { BrandManager } from "../components/settings/BrandManager";
import { CreateCompanyDialog } from "../components/settings/CreateCompanyDialog";

/** The shape `GET /api/settings` answers with (issue #39). */
interface CompanySettingsView {
  organizationId: string;
  displayName: string | null;
  address: string | null;
  gstin: string | null;
  skuFormat: string;
  skuSeparator: string;
  skuSequence: number;
  returnWindowDays: number;
  returnsEnabled: boolean;
  creditTermDays: number;
}

interface ProfileValues {
  displayName: string;
  address: string;
  gstin: string;
}

interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  gstin?: string | null;
  createdAt?: string;
}

/**
 * Company Management & Settings (ADR 0004 & Issue #42).
 *
 * Allows viewing all user companies, switching between them, creating a new company,
 * and managing active company profile, SKU formats, return policies, and brands.
 */
export function CompanySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeOrgId, setActiveOrgId] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);

  const [sku, setSku] = useState({
    format: "{BRAND}-{CATEGORY}-{SEQ:5}",
    separator: "-",
    sequence: 0,
  });

  const [returnWindowDays, setReturnWindowDays] = useState(30);
  const [returnsEnabled, setReturnsEnabled] = useState(true);

  const form = useForm<ProfileValues>({
    defaultValues: { displayName: "", address: "", gstin: "" },
  });

  const loadOrganizations = () => {
    setOrgsLoading(true);
    api
      .get("/organizations")
      .then((orgs: OrganizationItem[]) => {
        if (Array.isArray(orgs)) {
          setOrganizations(orgs);
        }
      })
      .catch(() => {
        // Silent catch for org listing fallback
      })
      .finally(() => {
        setOrgsLoading(false);
      });
  };

  const loadSettings = () => {
    setLoading(true);
    api
      .get("/settings")
      .then((settings: CompanySettingsView) => {
        setActiveOrgId(settings.organizationId);
        form.reset({
          displayName: settings.displayName ?? "",
          address: settings.address ?? "",
          gstin: settings.gstin ?? "",
        });
        setSku({
          format: settings.skuFormat,
          separator: settings.skuSeparator,
          sequence: settings.skuSequence,
        });
        setReturnWindowDays(settings.returnWindowDays);
        setReturnsEnabled(settings.returnsEnabled);
      })
      .catch((err: Error) => {
        toast.error(failureMessage(err, "Failed to load settings"));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadOrganizations();
    loadSettings();
  }, []);

  const onSubmit = async (values: ProfileValues) => {
    setSaving(true);
    setSaved(false);

    try {
      await api.put("/settings", {
        ...values,
        skuFormat: sku.format,
        skuSeparator: sku.separator,
        returnWindowDays,
        returnsEnabled,
      });
      setSaved(true);
      toast.success("Company settings saved");
      loadOrganizations();
    } catch (err: unknown) {
      toast.error(failureMessage(err instanceof Error ? err : new Error(String(err)), "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchCompany = async (targetOrgId: string) => {
    setSwitchingId(targetOrgId);

    try {
      await api.post("/organizations/set-active", { organizationId: targetOrgId });
      toast.success("Company switched");
      setActiveOrgId(targetOrgId);
      loadSettings();
      loadOrganizations();

      if (typeof window !== "undefined" && window.location?.reload) {
        window.location.reload();
      }
    } catch (err: unknown) {
      toast.error(failureMessage(err instanceof Error ? err : new Error(String(err)), "Failed to switch company"));
    } finally {
      setSwitchingId(null);
    }
  };

  // If activeOrg has loaded and organization list is loaded or we have activeOrgId
  const effectiveActiveOrgId = activeOrgId || organizations[0]?.id || "";

  return (
    <div className="space-y-6 max-w-5xl animate-slideInUp pb-12">
      {/* Header with primary Create Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="size-6 text-primary" />
            Companies & Organization
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your distribution entities, create new companies, and configure company settings.
          </p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="gap-1.5 shadow-sm self-start sm:self-auto"
        >
          <Plus className="size-4" />
          Create Company
        </Button>
      </div>

      {/* Companies Overview / Switcher Grid */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Your Companies</CardTitle>
          <CardDescription>
            Each company operates with independent stock, orders, and numbering.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgsLoading && organizations.length === 0 ? (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="p-4 rounded-lg border border-border/50 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {organizations.map((org) => {
                const isActive = org.id === effectiveActiveOrgId;

                return (
                  <div
                    key={org.id}
                    className={`relative flex flex-col justify-between p-4 rounded-lg border transition-all ${
                      isActive
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs"
                        : "border-border/70 bg-card hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm leading-tight text-foreground line-clamp-1">
                          {org.name}
                        </span>
                        {isActive && (
                          <Badge
                            variant="default"
                            className="text-[10px] px-1.5 py-0 h-4.5 bg-primary font-medium shrink-0"
                          >
                            Active Company
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {org.slug}
                      </p>
                      {org.gstin && (
                        <p className="text-xs text-muted-foreground truncate">
                          GSTIN: {org.gstin}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-2 border-t border-border/40 flex items-center justify-between">
                      {isActive ? (
                        <span className="text-xs font-medium text-primary flex items-center gap-1">
                          <CheckCircle2 className="size-3.5" /> Selected
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs w-full"
                          disabled={switchingId === org.id}
                          onClick={() => handleSwitchCompany(org.id)}
                          aria-label={`Switch to ${org.name}`}
                        >
                          {switchingId === org.id ? (
                            <Loader2 className="size-3 animate-spin mr-1" />
                          ) : null}
                          Switch to {org.name}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs / Panels for Active Company Settings */}
      {/* We mount panels and control view with Tabs */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto h-auto p-1 bg-muted/60">
          <TabsTrigger value="profile" className="gap-1.5 py-2">
            <Building2 className="size-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="sku" className="gap-1.5 py-2">
            <Settings2 className="size-4" />
            <span>SKU & Numbering</span>
          </TabsTrigger>
          <TabsTrigger value="policies" className="gap-1.5 py-2">
            <ShieldAlert className="size-4" />
            <span>Policies</span>
          </TabsTrigger>
          <TabsTrigger value="brands" className="gap-1.5 py-2">
            <Tags className="size-4" />
            <span>Brands</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile */}
        <TabsContent value="profile" forceMount className="data-[state=inactive]:hidden focus-visible:outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Profile</CardTitle>
              <CardDescription>
                Display name, address and GSTIN as they appear on documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading settings…
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
                    <FormField
                      control={form.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Acme Distribution" {...field} />
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
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input placeholder="12 Market Road" {...field} />
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
                            <Input placeholder="27AAPFU0939F1ZV" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-3 pt-2">
                      <Button type="submit" disabled={saving}>
                        {saving ? (
                          <Loader2 className="size-4 animate-spin mr-1.5" />
                        ) : (
                          <Save className="size-4 mr-1.5" />
                        )}
                        Save
                      </Button>
                      <span role="status" className="text-sm text-muted-foreground">
                        {saved ? "Settings saved" : ""}
                      </span>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: SKU Format */}
        <TabsContent value="sku" forceMount className="data-[state=inactive]:hidden focus-visible:outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">SKU Format</CardTitle>
              <CardDescription>
                How new product codes are generated — applies to products created after saving
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SkuFormatBuilder
                format={sku.format}
                separator={sku.separator}
                sequence={sku.sequence}
                onChange={(next) => setSku((prev) => ({ ...prev, ...next }))}
              />
              <div className="pt-2">
                <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                  Update SKU Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Policies */}
        <TabsContent value="policies" forceMount className="data-[state=inactive]:hidden focus-visible:outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Return Policy</CardTitle>
              <CardDescription>
                How long a sale return is accepted after the invoice date
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2 max-w-48">
                <Label htmlFor="return-window-days">Return Window (days)</Label>
                <Input
                  id="return-window-days"
                  type="number"
                  min={0}
                  value={returnWindowDays}
                  onChange={(event) => setReturnWindowDays(Number(event.target.value))}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="returns-enabled"
                  type="checkbox"
                  checked={returnsEnabled}
                  onChange={(event) => setReturnsEnabled(event.target.checked)}
                  className="size-4 rounded border-input"
                />
                <Label htmlFor="returns-enabled" className="cursor-pointer">
                  Accept sale returns
                </Label>
              </div>
              <div className="pt-2">
                <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                  Update Policies
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Brands */}
        <TabsContent value="brands" forceMount className="data-[state=inactive]:hidden focus-visible:outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Brands</CardTitle>
              <CardDescription>
                Manage product brands for this company (create and rename)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BrandManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Creation Modal */}
      <CreateCompanyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={async () => {
          loadOrganizations();
          loadSettings();
        }}
      />
    </div>
  );
}

export default CompanySettingsPage;
