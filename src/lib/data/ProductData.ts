export const mockSuppliers = [
  { id: "sup1", name: "ABC Suppliers Ltd" },
  { id: "sup2", name: "XYZ Trading Co" },
  { id: "sup3", name: "Global Imports" },
  { id: "sup4", name: "Local Distributors" },
]

export const mockCategories = [
  { id: "cat1", name: "Electronics" },
  { id: "cat2", name: "Food & Beverages" },
  { id: "cat3", name: "Clothing" },
  { id: "cat4", name: "Home & Garden" },
  { id: "cat5", name: "Health & Beauty" },
]

export const mockBrands = [
  { id: "brand1", name: "Samsung" },
  { id: "brand2", name: "Apple" },
  { id: "brand3", name: "Nike" },
  { id: "brand4", name: "Adidas" },
  { id: "brand5", name: "Generic" },
]

export const mockGroups = [
  { id: "group1", name: "Premium Products" },
  { id: "group2", name: "Standard Products" },
  { id: "group3", name: "Budget Products" },
  { id: "group4", name: "Seasonal Products" },
]

export const mockProductData: {
  id: string;
  productCode: string;
  productName: string;
  isActive: boolean;
  packs: number;
  weightKg: number;
  supplierId: string;
  categoryId: string;
  brandId: string;
  packStockQty: number;
  pcsStockQty: number;
  openingPacksQty: number;
  openingPcsQty: number;
  lastPurchaseUnitCost: number;
  lastPurchaseCartonCost: number;
  unitSalePrice: number;
  cartonSalePrice: number;
  counterUnitSalePrice: number;
  counterCartonSalePrice: number;
  minimumUnitPrice: number;
  profitMarginPercent: number;
  salesTaxPercent: number;
  applyOnTP: boolean;
  additionalTaxPercent: number;
  packDisplayCartonPrice: number;
  taxPerUnit: number;
  taxableAmountPerUnit: number;
} = {
  id: "prod1",
  productCode: "10464",
  productName: "LACTOGEN MILK",
  isActive: true,
  packs: 1,
  weightKg: 0,
  supplierId: "sup1",
  categoryId: "cat2",
  brandId: "brand5",
  packStockQty: 1,
  pcsStockQty: 0,
  openingPacksQty: 0,
  openingPcsQty: 0,
  lastPurchaseUnitCost: 0.1,
  lastPurchaseCartonCost: 0.1,
  unitSalePrice: 0.0,
  cartonSalePrice: 0.0,
  counterUnitSalePrice: 0.0,
  counterCartonSalePrice: 0.0,
  minimumUnitPrice: 0.0,
  profitMarginPercent: 0.0,
  salesTaxPercent: 0,
  applyOnTP: false,
  additionalTaxPercent: 0,
  packDisplayCartonPrice: 0.0,
  taxPerUnit: 0.0,
  taxableAmountPerUnit: 0.0,
}
