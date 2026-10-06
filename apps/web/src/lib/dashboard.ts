/**
 * The `GET /api/dashboard/stats` payload.
 *
 * Three components render different slices of this one response (the counters,
 * the activity feed, the stock chart), so the shape lives here rather than
 * being restated per component and drifting apart.
 */

export interface RecentSale {
  id: string;
  saleCode: string;
  totalAmount: number;
  status: string;
  saleDate: string;
  customer: { name: string };
}

export interface RecentPurchase {
  id: string;
  purchaseCode: string;
  totalAmount: number;
  status: string;
  purchaseDate: string;
  supplier: { companyName: string };
}

export interface StockRow {
  id: string;
  quantityOnHand: number;
  reorderLevel: number;
  product: { name: string; productCode: string };
}

export interface DashboardStats {
  totalProducts: number;
  totalCustomers: number;
  totalSuppliers: number;
  totalSalesAmount: number;
  totalPurchasesAmount: number;
  lowStockCount: number;
  recentSales: RecentSale[];
  recentPurchases: RecentPurchase[];
  topInventory: StockRow[];
}
