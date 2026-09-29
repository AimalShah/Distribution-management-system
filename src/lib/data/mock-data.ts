
export const mockCompanies = [
  {
    id: "1",
    name: "Acme Distribution Co.",
    logo: "AC",
    plan: "Enterprise",
    isActive: true,
  },
  {
    id: "2",
    name: "Global Supply Chain Ltd.",
    logo: "GS",
    plan: "Professional",
    isActive: false,
  },
  {
    id: "3",
    name: "Metro Logistics Inc.",
    logo: "ML",
    plan: "Starter",
    isActive: false,
  },
]

export const mockUser = {
  id: "1",
  name: "John Smith",
  email: "john.smith@acmedistribution.com",
  avatar: "JS",
  role: "Distribution Manager",
  company: "Acme Distribution Co.",
}

export const mockSuppliers = [
  {
    id: "1",
    name: "Global Electronics Ltd",
    email: "contact@globalelectronics.com",
    phone: "+1-555-0123",
    address: "123 Industrial Ave, Tech City, TC 12345",
    status: "active",
    rating: 4.5,
  },
  {
    id: "2",
    name: "Premium Parts Co",
    email: "sales@premiumparts.com",
    phone: "+1-555-0456",
    address: "456 Supply Chain Blvd, Commerce City, CC 67890",
    status: "active",
    rating: 4.2,
  },
  {
    id: "3",
    name: "Quick Components Inc",
    email: "orders@quickcomponents.com",
    phone: "+1-555-0789",
    address: "789 Fast Lane, Speed City, SC 11111",
    status: "inactive",
    rating: 3.8,
  },
]

export const mockProducts = [
  {
    id: "1",
    name: "Wireless Bluetooth Headphones",
    sku: "WBH-001",
    category: "Electronics",
    price: 99.99,
    stock: 150,
    minStock: 20,
    supplierId: "1",
    status: "active",
  },
  {
    id: "2",
    name: "USB-C Charging Cable",
    sku: "UCC-002",
    category: "Accessories",
    price: 19.99,
    stock: 5,
    minStock: 50,
    supplierId: "1",
    status: "active",
  },
  {
    id: "3",
    name: "Smartphone Case",
    sku: "SC-003",
    category: "Accessories",
    price: 24.99,
    stock: 200,
    minStock: 30,
    supplierId: "2",
    status: "active",
  },
]

export const mockOrders = [
  {
    id: "1",
    orderNumber: "ORD-2024-001",
    customerId: "CUST-001",
    customerName: "Tech Solutions Inc",
    items: [
      { productId: "1", productName: "Wireless Bluetooth Headphones", quantity: 10, price: 99.99 },
      { productId: "2", productName: "USB-C Charging Cable", quantity: 20, price: 19.99 },
    ],
    total: 1399.7,
    status: "processing",
    orderDate: new Date("2024-01-15"),
    deliveryDate: new Date("2024-01-22"),
  },
  {
    id: "2",
    orderNumber: "ORD-2024-002",
    customerId: "CUST-002",
    customerName: "Mobile World",
    items: [{ productId: "3", productName: "Smartphone Case", quantity: 50, price: 24.99 }],
    total: 1249.5,
    status: "shipped",
    orderDate: new Date("2024-01-14"),
    deliveryDate: new Date("2024-01-20"),
  },
]

export const mockShipments = [
  {
    id: "1",
    trackingNumber: "TRK-001-2024",
    orderId: "1",
    carrier: "FastShip Express",
    status: "in_transit",
    origin: "Distribution Center A",
    destination: "Tech Solutions Inc",
    estimatedDelivery: new Date("2024-01-22"),
  },
  {
    id: "2",
    trackingNumber: "TRK-002-2024",
    orderId: "2",
    carrier: "QuickDelivery",
    status: "delivered",
    origin: "Distribution Center B",
    destination: "Mobile World",
    estimatedDelivery: new Date("2024-01-20"),
    actualDelivery: new Date("2024-01-19"),
  },
]


export const demoProfile = {
  name: "John Doe",
  email: "john.doe@company.com",
  companyName: "Tech Solutions Inc.",
  companyPhone: "+1 (555) 123-4567",
  companyAddress: "123 Business Ave",
  city: "San Francisco, CA",
  avatarUrl:
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
};

