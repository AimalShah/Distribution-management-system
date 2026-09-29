export interface PurchaseFormData {
  purchaseCode: string;
  supplierId: string;
  purchaseDate: Date;
  status: string;
  discount?: number;
  taxAmount?: number;
  totalAmount: number;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    batchNumber?: string;
    expiryDate?: Date;
    taxPercent?: number;
    itemDiscount?: number;
  }>;
}
