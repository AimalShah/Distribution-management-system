
export interface SaleInvoiceItems {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxPercent?: number;
  discount?: number;
}


export interface SaleInvoiceFormData {
  saleCode: string;
  customerId: string;
  taxAmount: number;
  totalAmount: number;
  discount: number;
  status: string;
  saleDate: Date;
  items: SaleInvoiceItems[];
}