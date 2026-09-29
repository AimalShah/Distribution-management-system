export type ReturnItemInput = {
  productId: string;
  quantity: number;
  taxAmount: number;
  discount: number;
  unitPrice: number;
  note?: string;
};

export interface ReturnFormData {
  customerId: string;
  supplierId: string;
  returnCode: string;
  returnDate: Date;
  returnType: ReturnType;
  reason?: string;
  items: ReturnItemInput[];
}

/**
 * A const object rather than a TS `enum`: the values coming back from Prisma
 * are plain string literals, which are not assignable to a real enum type.
 * This form keeps `ReturnType.SALE` usable while letting the type be the
 * literal union.
 */
export const ReturnType = {
  SALE: "SALE",
  PURCHASE: "PURCHASE",
  EXPIRED: "EXPIRED",
  DAMAGED: "DAMAGED",
} as const;

export type ReturnType = (typeof ReturnType)[keyof typeof ReturnType];
