export interface SaleItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerAvatar: string;
  date: string;
  amount: number;
  paymentMethod: string;
  status: 'Paid' | 'Pending' | 'Partial' | 'Cancelled';
  items?: { name: string; sku: string; qty: number; unitPrice: number; total: number }[];
}

export interface LowStockProduct {
  id: string;
  name: string;
  image: string;
  sku: string;
  currentStock: number;
  minStock: number;
  status: 'Critical' | 'Out of Stock' | 'Low Stock';
  price: number;
  category: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'warning' | 'success' | 'info' | 'danger' | 'primary';
  unread: boolean;
}
