export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export interface Brand {
  id: string;
  name: string;
  categoryId: string;
  description: string | null;
}

/** `GET /api/products` row (`listInclude` in the product service). */
export interface Product {
  id: string;
  productCode: string;
  name: string;
  description: string | null;
  categoryId: string;
  brandId: string;
  unit: string;
  unitCost: number;
  unitPrice: number;
  isActive: boolean;
  category: Category | null;
  brand: Brand | null;
  inventory: { quantityOnHand: number; reorderLevel: number } | null;
}

/** The legacy form's units, values unchanged so existing rows still match. */
export const UNITS = [
  { value: "pcs", label: "Pieces" },
  { value: "kg", label: "Kilograms" },
  { value: "ltr", label: "Liters" },
  { value: "box", label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "m", label: "Meters" },
  { value: "g", label: "Grams" },
] as const;

/**
 * Option lists for selects. The list endpoints cap `pageSize` at 100; a tenant
 * with more categories than that needs a searchable picker, not a longer list.
 */
export const OPTIONS_PAGE_SIZE = 100;
