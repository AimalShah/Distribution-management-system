export interface CustomerFormData {
  customerCode: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  creditLimit: number;
  isActive: boolean;
}

export type Customers = {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  creditLimit: number;
  isActive: boolean;
};
