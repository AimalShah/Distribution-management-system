import { SaleItem, LowStockProduct, NotificationItem } from '../types';

export const initialSales: SaleItem[] = [
  {
    id: '1',
    invoiceNumber: 'INV-000125',
    customerName: 'John Smith',
    customerAvatar: '/assets/img/avator/1.jpg',
    date: 'Aug 24, 2026',
    amount: 845.00,
    paymentMethod: 'Cash',
    status: 'Paid',
    items: [
      { name: 'Wireless Ergonomic Mouse', sku: 'WM-001', qty: 5, unitPrice: 29.00, total: 145.00 },
      { name: 'Mechanical RGB Keyboard', sku: 'MGK-002', qty: 4, unitPrice: 125.00, total: 500.00 },
      { name: 'High-Speed USB-C Hub', sku: 'UCH-008', qty: 4, unitPrice: 50.00, total: 200.00 }
    ]
  },
  {
    id: '2',
    invoiceNumber: 'INV-000124',
    customerName: 'Michael Brown',
    customerAvatar: '/assets/img/avator/2.jpg',
    date: 'Aug 23, 2026',
    amount: 1240.00,
    paymentMethod: 'Credit Card',
    status: 'Pending',
    items: [
      { name: 'Ultra-Clear 4K Monitor', sku: 'MON-4K', qty: 2, unitPrice: 420.00, total: 840.00 },
      { name: 'Studio Monitoring Headphones', sku: 'WH-009', qty: 2, unitPrice: 150.00, total: 300.00 },
      { name: 'Heavy Duty Monitor Arm', sku: 'ARM-01', qty: 1, unitPrice: 100.00, total: 100.00 }
    ]
  },
  {
    id: '3',
    invoiceNumber: 'INV-000123',
    customerName: 'Sarah Wilson',
    customerAvatar: '/assets/img/avator/3.jpg',
    date: 'Aug 22, 2026',
    amount: 620.00,
    paymentMethod: 'Bank Transfer',
    status: 'Partial',
    items: [
      { name: 'Wireless Fast Charger Pad', sku: 'WCH-015', qty: 6, unitPrice: 45.00, total: 270.00 },
      { name: 'Hi-Fi Bluetooth Portable Speaker', sku: 'BS-005', qty: 5, unitPrice: 70.00, total: 350.00 }
    ]
  },
  {
    id: '4',
    invoiceNumber: 'INV-000122',
    customerName: 'David Miller',
    customerAvatar: '/assets/img/avator/1.jpg',
    date: 'Aug 21, 2026',
    amount: 380.00,
    paymentMethod: 'Cash',
    status: 'Cancelled',
    items: [
      { name: 'Compact Bluetooth Speaker', sku: 'BS-003', qty: 4, unitPrice: 95.00, total: 380.00 }
    ]
  },
  {
    id: '5',
    invoiceNumber: 'INV-000121',
    customerName: 'Emma Johnson',
    customerAvatar: '/assets/img/avator/2.jpg',
    date: 'Aug 20, 2026',
    amount: 1895.00,
    paymentMethod: 'Credit Card',
    status: 'Paid',
    items: [
      { name: 'Enterprise Laser Printer', sku: 'PRN-900', qty: 2, unitPrice: 650.00, total: 1300.00 },
      { name: 'High-Yield Toner Cartridges', sku: 'TNR-400', qty: 5, unitPrice: 79.00, total: 395.00 },
      { name: 'Reinforced Print Cable Bundle', sku: 'CBL-09', qty: 4, unitPrice: 50.00, total: 200.00 }
    ]
  }
];

export const initialLowStock: LowStockProduct[] = [
  {
    id: '1',
    name: 'Wireless Mouse',
    image: '/assets/img/products/mouse.jpg',
    sku: 'WM-001',
    currentStock: 3,
    minStock: 10,
    status: 'Critical',
    price: 29.00,
    category: 'Peripherals'
  },
  {
    id: '2',
    name: 'Bluetooth Speaker',
    image: '/assets/img/products/speeker.jpg',
    sku: 'BS-005',
    currentStock: 0,
    minStock: 5,
    status: 'Out of Stock',
    price: 65.00,
    category: 'Audio'
  },
  {
    id: '3',
    name: 'Wireless Headphones',
    image: '/assets/img/products/headphone.jpg',
    sku: 'WH-009',
    currentStock: 5,
    minStock: 8,
    status: 'Low Stock',
    price: 110.00,
    category: 'Audio'
  },
  {
    id: '4',
    name: 'Wireless Charger',
    image: '/assets/img/products/powerbank.jpg',
    sku: 'WCH-015',
    currentStock: 2,
    minStock: 8,
    status: 'Low Stock',
    price: 45.00,
    category: 'Accessories'
  }
];

export const initialNotifications: NotificationItem[] = [
  {
    id: '1',
    title: 'Low Stock Alert',
    message: 'Wireless Mouse has only 3 items remaining.',
    time: '5 min ago',
    type: 'warning',
    unread: true
  },
  {
    id: '2',
    title: 'New Sale Created',
    message: 'INV-000125 was created for $845.00.',
    time: '18 min ago',
    type: 'success',
    unread: true
  },
  {
    id: '3',
    title: 'Payment Received',
    message: '$1,250 payment received from John Smith.',
    time: '1 hr ago',
    type: 'info',
    unread: true
  },
  {
    id: '4',
    title: 'Invoice Overdue',
    message: 'INV-000119 is past due date.',
    time: '2 hrs ago',
    type: 'danger',
    unread: true
  },
  {
    id: '5',
    title: 'Stock Adjusted',
    message: 'Mechanical Keyboard stock adjusted by +50 units.',
    time: 'Yesterday',
    type: 'primary',
    unread: false
  }
];
