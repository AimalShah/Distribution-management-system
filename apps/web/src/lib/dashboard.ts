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
  /** Batches with stock expiring inside the next 30 days. */
  expiringSoonCount: number;
  /** Batches with stock already past expiry. */
  expiredCount?: number;
  recentSales: RecentSale[];
  recentPurchases: RecentPurchase[];
  topInventory: StockRow[];
  outstanding?: number;
}

/**
 * `GET /api/reports/sales/basic` for a `startDate`/`endDate` window.
 * Every number is aggregated server side over the window; nothing on the page
 * extrapolates or fakes a value when a field is missing.
 */
export interface SalesBasicReport {
  totalSales: number;
  totalOrders: number;
  uniqueCustomers: number;
  totalQuantity: number;
  dailyTotals: { date: string; total: number }[];
  byStatus: StatusBucket[];
}

/** `GET /api/reports/purchase/basic` for a `startDate`/`endDate` window. */
export interface PurchaseBasicReport {
  totalPurchaseAmount: number;
  totalOrders: number;
  totalQuantity: number;
  dailyTotals: { date: string; total: number }[];
  byStatus: StatusBucket[];
}

/** One invoice-status slice of a window report: `Completed`, `Pending`, … */
export interface StatusBucket {
  status: string;
  orders: number;
  totalAmount: number;
}

/** One row of `GET /api/reports/sales/by-product`, already revenue-ranked. */
export interface ProductSalesRow {
  productId: string;
  name: string;
  productCode: string;
  unit?: string;
  quantity: number;
  totalPrice: number;
}

/** One row of `GET /api/reports/sales/by-customer`, revenue-ranked. */
export interface CustomerSalesRow {
  customerId: string;
  name: string;
  customerCode?: string;
  isActive?: boolean;
  orders: number;
  totalAmount: number;
}

/** One row of `GET /api/inventory/low-stock` (server-ordered qty asc). */
export interface LowStockRow {
  id: string;
  quantityOnHand: number;
  reorderLevel: number;
  product: { name: string; productCode: string };
}
