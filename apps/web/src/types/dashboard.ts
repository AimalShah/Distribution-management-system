/** `GET /api/dashboard/stats`, as JSON (dates arrive as ISO strings). */
export interface DashboardStats {
  totals: { sales: number; purchases: number; customers: number; products: number };
  /** Percent change, this calendar month against last; `null` when last month was empty. */
  trends: { sales: number | null; purchases: number | null };
  lowStockCount: number;
  topProducts: { productId: string; name: string; totalSold: number; totalRevenue: number }[];
  recentActivities: {
    type: "sale" | "purchase";
    id: string;
    code: string;
    date: string;
    amount: number;
    counterparty: string;
  }[];
  inventoryLevels: { productId: string; name: string; quantityOnHand: number; reorderLevel: number }[];
}

/** The slice of `GET /api/reports/sales/basic` the dashboard reads. */
export interface SalesBasicReport {
  totalSales: number;
  dailyTotals: { date: string; total: number }[];
}
