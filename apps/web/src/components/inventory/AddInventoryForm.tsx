import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  InventoryCreateSchema,
  type InventoryCreateInput,
  type InventoryBulkImportRow,
} from "@dms/shared";
import {
  Badge,
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@dms/ui";
import { api, failureMessage, fetcher } from "../../lib/api";
import {
  parseInventoryCSV,
  validateInventoryRow,
  transformRowToInventoryInput,
  downloadInventoryCSVTemplate,
  type ParsedInventoryRow,
} from "../../lib/csv";

export interface AddInventoryFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddInventoryForm({ onSuccess, onCancel }: AddInventoryFormProps) {
  const [activeTab, setActiveTab] = useState<"manual" | "csv">("manual");
  const [submittingManual, setSubmittingManual] = useState(false);

  // CSV Import State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const [parsedRows, setParsedRows] = useState<
    {
      rowNumber: number;
      raw: ParsedInventoryRow;
      valid: boolean;
      errors: string[];
      transformed?: InventoryBulkImportRow;
    }[]
  >([]);

  const [importResult, setImportResult] = useState<{
    success: number;
    created: number;
    updated: number;
    errors: { row: number; productCode?: string; error: string }[];
  } | null>(null);

  // Products lookup for manual entry
  const { data: productsData } = useSWR("/products?page=1&pageSize=100", fetcher);

  const products: { id: string; name: string; productCode: string }[] =
    productsData?.data ?? [];

  // Manual Form
  const form = useForm<InventoryCreateInput>({
    resolver: zodResolver(InventoryCreateSchema),
    defaultValues: {
      productId: "",
      quantityOnHand: 0,
      reorderLevel: 10,
      maxStockLevel: 100,
      quantityReserved: 0,
    },
  });

  const onManualSubmit = async (values: InventoryCreateInput) => {
    setSubmittingManual(true);

    try {
      await api.post("/inventory", {
        productId: values.productId,
        quantityOnHand: Number(values.quantityOnHand),
        reorderLevel:
          values.reorderLevel !== undefined ? Number(values.reorderLevel) : undefined,
        maxStockLevel:
          values.maxStockLevel !== undefined ? Number(values.maxStockLevel) : undefined,
        quantityReserved:
          values.quantityReserved !== undefined
            ? Number(values.quantityReserved)
            : undefined,
      });
      toast.success("Inventory record created successfully");
      form.reset();
      onSuccess?.();
    } catch (err: any) {
      toast.error(failureMessage(err, "Failed to create inventory record"));
    } finally {
      setSubmittingManual(false);
    }
  };

  // CSV File Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setParsing(true);
    setImportResult(null);

    try {
      const rows = await parseInventoryCSV(file);

      if (rows.length === 0) {
        toast.error("CSV file is empty or contains no data rows");
        setParsedRows([]);

        return;
      }

      const analyzed = rows.map((raw, idx) => {
        const validation = validateInventoryRow(raw);

        return {
          rowNumber: idx + 1,
          raw,
          valid: validation.valid,
          errors: validation.errors,
          transformed: validation.valid ? transformRowToInventoryInput(raw) : undefined,
        };
      });

      setParsedRows(analyzed);
      toast.success(`Parsed ${rows.length} rows from CSV`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to parse CSV file");
      setParsedRows([]);
    } finally {
      setParsing(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClearCSV = () => {
    setFileName("");
    setParsedRows([]);
    setImportResult(null);
  };

  const validRows = parsedRows.filter((r) => r.valid && r.transformed);
  const invalidRows = parsedRows.filter((r) => !r.valid);

  const handleBulkImport = async () => {
    if (validRows.length === 0) {
      toast.error("No valid rows to import");

      return;
    }

    setImporting(true);

    try {
      const payload = validRows.map((r) => r.transformed!);
      const result = await api.post("/inventory/bulk-import", { rows: payload });
      setImportResult(result);

      if (result.success > 0) {
        toast.success(
          `Successfully imported ${result.success} records (${result.created} created, ${result.updated} updated)`
        );
        onSuccess?.();
      }

      if (result.errors && result.errors.length > 0) {
        toast.warning(`${result.errors.length} rows had errors during import`);
      }
    } catch (err: any) {
      toast.error(failureMessage(err, "Bulk import failed"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="add-inventory-form">
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          // SAFETY: this Tabs element declares exactly the two tabs below, so
          // the value it emits is one of them.
          setActiveTab(val as "manual" | "csv");
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual" data-testid="tab-manual-entry">
            Single Product Entry
          </TabsTrigger>
          <TabsTrigger value="csv" data-testid="tab-csv-import">
            Bulk CSV Import
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Manual Form */}
        <TabsContent value="manual" className="pt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onManualSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product">
                          <SelectValue placeholder="Select catalog product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.productCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantityOnHand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Stock on Hand</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          data-testid="input-quantity-on-hand"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reorderLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Threshold</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="10"
                          data-testid="input-reorder-level"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maxStockLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Stock Capacity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="100"
                          data-testid="input-max-stock-level"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantityReserved"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reserved Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          data-testid="input-quantity-reserved"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                {onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={submittingManual}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={submittingManual}
                  data-testid="btn-submit-manual-inventory"
                >
                  {submittingManual ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="size-4 mr-2" />
                      Create Inventory
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        {/* Tab 2: Bulk CSV Import */}
        <TabsContent value="csv" className="pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/40 border">
            <div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Inventory CSV Import Template
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Download the standardized CSV template with required columns: productCode, productName, quantityOnHand, reorderLevel, maxStockLevel.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadInventoryCSVTemplate()}
              className="shrink-0"
              data-testid="btn-download-csv-template"
            >
              <Download className="size-3.5 mr-2" />
              Download Template
            </Button>
          </div>

          {/* Upload Input & Drop Target */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/20 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
              data-testid="csv-file-input"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <Upload className="size-8 text-muted-foreground" />
              <div className="text-sm font-medium text-foreground">
                {fileName ? (
                  <span className="font-mono text-primary">{fileName}</span>
                ) : (
                  "Select an inventory CSV file to import"
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Only valid CSV files with product codes are supported
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={parsing || importing}
                  data-testid="btn-browse-csv"
                >
                  <Upload className="size-3.5 mr-2" />
                  {fileName ? "Choose Another File" : "Browse CSV File"}
                </Button>
                {fileName && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearCSV}
                    disabled={parsing || importing}
                  >
                    <Trash2 className="size-3.5 mr-2 text-destructive" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {parsing && (
            <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
              <Loader2 className="size-5 mr-2 animate-spin text-primary" />
              Parsing and validating CSV contents...
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Parsed Rows ({parsedRows.length})
                  </span>
                  <Badge variant="outline" className="text-xs">
                    <CheckCircle2 className="size-3 text-emerald-500 mr-1" />
                    {validRows.length} Valid
                  </Badge>
                  {invalidRows.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="size-3 mr-1" />
                      {invalidRows.length} Invalid
                    </Badge>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleBulkImport}
                  disabled={validRows.length === 0 || importing}
                  data-testid="btn-execute-bulk-import"
                >
                  {importing ? (
                    <>
                      <Loader2 className="size-3.5 mr-2 animate-spin" />
                      Importing ({validRows.length})...
                    </>
                  ) : (
                    <>
                      <Upload className="size-3.5 mr-2" />
                      Import {validRows.length} Valid Rows
                    </>
                  )}
                </Button>
              </div>

              {/* Preview Table */}
              <div className="border rounded-md overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs" data-testid="csv-preview-table">
                  <thead className="bg-muted sticky top-0 border-b">
                    <tr>
                      <th className="p-2 text-left font-semibold">#</th>
                      <th className="p-2 text-left font-semibold">Product Code</th>
                      <th className="p-2 text-left font-semibold">Product Name</th>
                      <th className="p-2 text-right font-semibold">Qty on Hand</th>
                      <th className="p-2 text-right font-semibold">Reorder</th>
                      <th className="p-2 text-right font-semibold">Max Stock</th>
                      <th className="p-2 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={row.valid ? "hover:bg-muted/30" : "bg-destructive/10"}
                      >
                        <td className="p-2 text-muted-foreground font-mono">{row.rowNumber}</td>
                        <td className="p-2 font-mono font-medium">{row.raw.productCode || "—"}</td>
                        <td className="p-2 truncate max-w-[120px]">{row.raw.productName || "—"}</td>
                        <td className="p-2 text-right font-mono">{row.raw.quantityOnHand ?? "—"}</td>
                        <td className="p-2 text-right font-mono">{row.raw.reorderLevel ?? "—"}</td>
                        <td className="p-2 text-right font-mono">{row.raw.maxStockLevel ?? "—"}</td>
                        <td className="p-2 text-center">
                          {row.valid ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                              Valid
                            </Badge>
                          ) : (
                            <span
                              className="text-[11px] text-destructive font-medium"
                              title={row.errors.join(", ")}
                            >
                              {row.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import Results Banner */}
              {importResult && (
                <div
                  className={`p-4 rounded-md border text-xs ${
                    importResult.errors.length === 0
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
                  }`}
                  data-testid="bulk-import-results"
                >
                  <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                    {importResult.errors.length === 0 ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-500" />
                    )}
                    Import Summary: {importResult.success} Succeeded, {importResult.errors.length} Failed
                  </div>
                  <p>
                    {importResult.created} new inventory records created, {importResult.updated} existing records updated.
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-2 space-y-1 pl-4 list-disc text-[11px] max-h-32 overflow-y-auto">
                      {importResult.errors.map((e, i) => (
                        <li key={i}>
                          Row {e.row}: {e.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
