export type SalesByCustomer = {
  customer: string;
  total: number;
};
export type SalesByCustomerType = {
  data: SalesByCustomer[];
};


export interface CardData {
  title: string;
  value: number | string;
  icon: LucideIcon;
  format?: (value: number) => string;
}