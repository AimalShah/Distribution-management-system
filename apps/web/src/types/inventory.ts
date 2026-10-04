/** `GET /api/inventory` row. */
export interface InventoryRow {
  id: string;
  productId: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderLevel: number;
  maxStockLevel: number | null;
  product: { id: string; name: string; productCode: string; unit: string };
  _count: { logs: number };
}

/** `GET /api/inventory/logs` row. */
export interface InventoryLogRow {
  id: string;
  movementType: string;
  quantity: number;
  previousQty: number;
  newQty: number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
  product: { id: string; name: string; productCode: string };
  user: { name: string; email: string };
}

/**
 * The movements a person can record by hand, with what each does. `TRANSFER`
 * is left out: the server refuses it (there is no location to transfer to).
 */
export const ADJUSTABLE_MOVEMENTS = [
  { value: "IN", label: "Stock in (adds)" },
  { value: "OUT", label: "Stock out (subtracts)" },
  { value: "RETURN", label: "Customer return (adds)" },
  { value: "DAMAGED", label: "Damaged (subtracts)" },
  { value: "EXPIRED", label: "Expired (subtracts)" },
  { value: "ADJUSTMENT", label: "Stock count (sets the quantity)" },
] as const;
