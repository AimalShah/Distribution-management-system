import { useMemo } from "react";
import useSWR from "swr";
import { Tag, TrendingUp, ShoppingBag, DollarSign } from "lucide-react";
import { fetcher } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import {
  KpiCardGrid,
  ReportBreakdownList,
  ReportSectionCard,
  ReportTabsSkeleton,
} from "./ReportPrimitives";

interface BrandReportTabProps {
  queryString: string;
}

export interface BrandSalesItem {
  brandId: string;
  brandName: string;
  productCount: number;
  quantity: number;
  totalAmount: number;
  lineItems: number;
}

export interface BrandPurchaseItem {
  brandId: string;
  brandName: string;
  productCount: number;
  quantity: number;
  totalCost: number;
  lineItems: number;
}

export function BrandReportTab({ queryString }: BrandReportTabProps) {
  const { data: salesBrands = [], isLoading: salesLoading } = useSWR<BrandSalesItem[]>(
    `/reports/sales/by-brand?${queryString}`,
    fetcher
  );

  const { data: purchaseBrands = [], isLoading: purchaseLoading } = useSWR<BrandPurchaseItem[]>(
    `/reports/purchase/by-brand?${queryString}`,
    fetcher
  );

  const isLoading = salesLoading || purchaseLoading;

  const totalSalesRevenue = useMemo(
    () => salesBrands.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
    [salesBrands]
  );

  const totalPurchaseSpend = useMemo(
    () => purchaseBrands.reduce((sum, b) => sum + (b.totalCost || 0), 0),
    [purchaseBrands]
  );

  const allBrandIds = useMemo(() => {
    const ids = new Set<string>();
    salesBrands.forEach((b) => ids.add(b.brandId));
    purchaseBrands.forEach((b) => ids.add(b.brandId));

    return ids;
  }, [salesBrands, purchaseBrands]);

  const cards = useMemo(
    () => [
      {
        title: "Active Brands",
        value: allBrandIds.size,
        icon: Tag,
        tileClassName: "bg-primary/10 text-primary",
      },
      {
        title: "Brand Sales Revenue",
        value: formatMoney(totalSalesRevenue),
        icon: TrendingUp,
        tileClassName: "bg-emerald-500/10 text-emerald-600",
      },
      {
        title: "Brand Procurement Spend",
        value: formatMoney(totalPurchaseSpend),
        icon: ShoppingBag,
        tileClassName: "bg-amber-500/10 text-amber-600",
      },
      {
        title: "Gross Brand Margin",
        value: formatMoney(totalSalesRevenue - totalPurchaseSpend),
        icon: DollarSign,
        tileClassName: "bg-blue-500/10 text-blue-600",
      },
    ],
    [allBrandIds.size, totalSalesRevenue, totalPurchaseSpend]
  );

  if (isLoading) {
    return <ReportTabsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Brand KPIs */}
      <KpiCardGrid cards={cards} />

      {/* Breakdowns: Sales by Brand and Purchases by Brand */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales by Brand */}
        <ReportBreakdownList
          title="Sales by Brand"
          description="Revenue generated grouped by product brand."
          emptyText="No sales recorded for this period"
          rows={salesBrands.map((brand) => ({
            key: brand.brandId,
            label: brand.brandName,
            sub: `${brand.quantity} units (${brand.productCount} products)`,
            right: formatMoney(brand.totalAmount),
          }))}
        />

        {/* Purchases by Brand */}
        <ReportBreakdownList
          title="Purchases by Brand"
          description="Procurement cost grouped by product brand."
          emptyText="No purchases recorded for this period"
          rows={purchaseBrands.map((brand) => ({
            key: brand.brandId,
            label: brand.brandName,
            sub: `${brand.quantity} units (${brand.productCount} products)`,
            right: formatMoney(brand.totalCost),
          }))}
        />
      </div>

      {/* Detailed Brand Performance Table */}
      <ReportSectionCard
        title="Comprehensive Brand Portfolio Performance"
        description="Side-by-side performance metrics of brands in the selected timeframe"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="py-3 px-4 font-semibold">Brand</th>
                <th className="py-3 px-4 text-center font-semibold">Products Sold</th>
                <th className="py-3 px-4 text-right font-semibold">Sales Revenue</th>
                <th className="py-3 px-4 text-right font-semibold">Procurement Spend</th>
                <th className="py-3 px-4 text-right font-semibold">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {salesBrands.length === 0 && purchaseBrands.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                    No brand transactions recorded in this period.
                  </td>
                </tr>
              ) : (
                salesBrands.map((sb) => {
                  const pb = purchaseBrands.find((p) => p.brandId === sb.brandId);
                  const spend = pb?.totalCost ?? 0;
                  const balance = sb.totalAmount - spend;

                  return (
                    <tr key={sb.brandId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">
                        {sb.brandName}
                      </td>
                      <td className="py-3 px-4 text-center text-muted-foreground">
                        {sb.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                        {formatMoney(sb.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-amber-600">
                        {formatMoney(spend)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-semibold ${
                          balance >= 0 ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {formatMoney(balance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </ReportSectionCard>
    </div>
  );
}
