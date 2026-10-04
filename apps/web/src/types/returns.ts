/** `GET /api/returns` row. */
export interface ReturnListRow {
  id: string;
  returnCode: string;
  returnType: "SALE" | "PURCHASE" | "EXPIRED" | "DAMAGED";
  returnDate: string;
  reason: string | null;
  user: { name: string; email: string };
  _count: { items: number };
}

/** What each return type does to stock, shown beside the picker. */
export const RETURN_TYPES = [
  { value: "SALE", label: "Customer return", effect: "Stock comes back in" },
  { value: "PURCHASE", label: "Return to supplier", effect: "Stock goes out" },
  { value: "DAMAGED", label: "Damaged write-off", effect: "Stock goes out" },
  { value: "EXPIRED", label: "Expired write-off", effect: "Stock goes out" },
] as const;

/** A sale or purchase detail, narrowed to what a return form reads from it. */
export interface ReturnableLine {
  productId: string;
  quantity: number;
  price: number;
  product: { id: string; name: string; productCode: string };
}
