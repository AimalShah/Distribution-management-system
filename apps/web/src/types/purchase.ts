export interface Supplier {
  id: string;
  supplierCode: string;
  companyName: string;
  contactPerson: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  isActive: boolean;
}

/** The legacy new-purchase page's options, values unchanged. */
export const PURCHASE_STATUSES = ["Pending", "Approved", "Completed", "Cancelled"] as const;

/** `GET /api/purchases` row. Lines are counted, not embedded, on the list. */
export interface PurchaseListRow {
  id: string;
  purchaseCode: string;
  purchaseDate: string;
  status: string;
  totalAmount: number;
  supplier: { id: string; companyName: string };
  _count: { purchaseItems: number };
}

/** `GET /api/purchases/:id`. */
export interface PurchaseDetail {
  id: string;
  purchaseCode: string;
  purchaseDate: string;
  status: string;
  supplierId: string;
  totalAmount: number;
  discount: number | null;
  taxAmount: number | null;
  supplier: { id: string; companyName: string };
  purchaseItems: {
    id: string;
    productId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    batchNumber: string | null;
    expiryDate: string | null;
    taxPercent: number | null;
    discount: number | null;
    product: { id: string; name: string; productCode: string };
  }[];
}
