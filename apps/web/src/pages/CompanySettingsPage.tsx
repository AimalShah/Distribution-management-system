import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
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
} from "@dms/ui";
import { useForm } from "react-hook-form";
import { api, failureMessage } from "../lib/api";
import { SkuFormatBuilder } from "../components/settings/SkuFormatBuilder";

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

/**
 * The active Company's document profile: the name, address and GSTIN the
 * invoice header prints. The SKU format, return policy and credit terms that
 * live in the same row arrive in later slices of the #39 chain.
 */
export function CompanySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sku, setSku] = useState({ format: "{BRAND}-{CATEGORY}-{SEQ:5}", separator: "-", sequence: 0 });
  const [returnWindowDays, setReturnWindowDays] = useState(30);
  const [returnsEnabled, setReturnsEnabled] = useState(true);

  const form = useForm<ProfileValues>({
    defaultValues: { displayName: "", address: "", gstin: "" },
  });

  useEffect(() => {
    let cancelled = false;

    api
      .get("/settings")
      .then((settings: CompanySettingsView) => {
        if (cancelled) return;

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
      .catch((err: unknown) => {
        if (!cancelled) toast.error(failureMessage(err as Error, "Failed to load settings"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form]);

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
    } catch (err: unknown) {
      toast.error(failureMessage(err as Error, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl animate-slideInUp">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Company Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          The profile printed on invoices and documents
        </p>
      </div>

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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">SKU Format</CardTitle>
          <CardDescription>
            How new product codes are generated — applies to products created after saving
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SkuFormatBuilder
            format={sku.format}
            separator={sku.separator}
            sequence={sku.sequence}
            onChange={(next) => setSku((prev) => ({ ...prev, ...next }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Return Policy</CardTitle>
          <CardDescription>
            How long a sale return is accepted after the invoice date
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-40">
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
              className="size-4"
            />
            <Label htmlFor="returns-enabled" className="cursor-pointer">
              Accept sale returns
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CompanySettingsPage;
