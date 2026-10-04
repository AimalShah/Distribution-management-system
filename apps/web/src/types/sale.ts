export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

/** `GET /api/sales` row. Lines are counted, not embedded, on the list. */
export interface SaleListRow {
  id: string;
  saleCode: string;
  saleDate: string;
  status: string;
  totalAmount: number;
  customer: { id: string; name: string };
  _count: { items: number };
}
