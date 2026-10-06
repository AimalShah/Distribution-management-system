import { useState, useMemo, useEffect } from "react";
import type { DateRange } from "react-day-picker";
import { RefreshCw } from "lucide-react";
import {
  Button,
  DateRangePicker,
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
import { SalesReportTab } from "../components/reports/SalesReportTab";
import { PurchaseReportTab } from "../components/reports/PurchaseReportTab";
import { InventoryReportTab } from "../components/reports/InventoryReportTab";
import { ListPageHeader } from "../components/list/ListPageHeader";

export default function ReportsPage() {
  const [period, setPeriod] = useState<string>("monthly");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return { from: start, to: end };
  });

  useEffect(() => {
    const now = new Date();
    let start: Date;
    const end = new Date();

    switch (period) {
      case "daily":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly":
        start = new Date();
        start.setDate(now.getDate() - 7);
        break;
      case "monthly":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "yearly":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case "custom":
        return;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    setDateRange({ from: start, to: end });
  }, [period]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (dateRange?.from) {
      params.set("startDate", dateRange.from.toISOString());
    }
    if (dateRange?.to) {
      params.set("endDate", dateRange.to.toISOString());
    }
    return params.toString();
  }, [dateRange]);

  return (
    <div className="space-y-5 animate-slideInUp">
      {/* Invenza Breadcrumb & Action Header */}
      <ListPageHeader
        breadcrumb={
          <>
            <span className="hover:text-primary transition-colors cursor-pointer">
              Dashboard
            </span>
            <span>/</span>
            <span className="text-muted-foreground">Analytics</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Reports</span>
          </>
        }
        title="Reports &amp; Analytics"
        subtitle="Audit sales revenue, procurement spend, and warehouse stock balances"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (dateRange) {
                setDateRange({ ...dateRange });
              }
            }}
            className="btn-secondary h-9 rounded-md cursor-pointer"
          >
            <RefreshCw className="size-3.5 mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Date Filters Card */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3 bg-card border-border">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Time Horizon:</span>
          <Select
            value={period}
            onValueChange={(val) => {
              setPeriod(val);
            }}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs rounded-lg bg-background">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          <DateRangePicker
            value={dateRange}
            onChange={(newRange) => {
              setDateRange(newRange);
              if (period !== "custom") {
                setPeriod("custom");
              }
            }}
            className="h-9 text-xs rounded-lg"
          />
        </div>
      </div>

      {/* Reports Tabs */}
      <Tabs defaultValue="salesReport" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 rounded-xl">
          <TabsTrigger value="salesReport" className="rounded-lg text-xs font-medium px-4">Sales Report</TabsTrigger>
          <TabsTrigger value="purchaseReport" className="rounded-lg text-xs font-medium px-4">Purchase Report</TabsTrigger>
          <TabsTrigger value="inventoryReport" className="rounded-lg text-xs font-medium px-4">Inventory Report</TabsTrigger>
        </TabsList>

        <TabsContent value="salesReport">
          <SalesReportTab queryString={queryString} />
        </TabsContent>

        <TabsContent value="purchaseReport">
          <PurchaseReportTab queryString={queryString} />
        </TabsContent>

        <TabsContent value="inventoryReport">
          <InventoryReportTab queryString={queryString} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
