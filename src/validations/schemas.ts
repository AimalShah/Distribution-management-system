import { z } from "zod";

/**
 * Email field that accepts an empty string (unset optional input) while still
 * validating real addresses. `z.preprocess` is avoided on purpose: in zod v4 it
 * widens the schema input to `unknown`, which breaks react-hook-form's
 * `zodResolver` generics.
 */
const optionalEmail = () =>
  z.union([z.literal(""), z.string().email("Invalid email")]).optional();

// export const registerSchema = z
//   .object({
//     name: z.string().min(1, "Name is required"),
//     email: z.string().email("Invalid email address"),
//     password: z.string().min(8, "Password must be at least 8 characters long"),
//     confirmPassword: z
//       .string()
//       .min(8, "Confirm Password must be at least 8 characters long"),
//     companyName: z.string().min(1, "Company Name is required"),
//     companyAddress: z.string().min(1, "Company Address is required"),
//     city: z.string().min(1, "City is required"),
//     companyPhone: z
//       .string()
//       .min(1, "Company Phone is required")
//       .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format."),
//   })
//   .refine((data) => data.password === data.confirmPassword, {
//     message: "Passwords do not match",
//     path: ["confirmPassword"],
//   });

export const SingupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
}); 

export const registerCompanySchema = z.object({
  companyName: z.string().min(1, "Company Name is required"),
  companySlug: z.string().regex(/^[a-z0-9]+$/, {
    message: "Only lowercase letters and numbers are allowed.",
  }),
  companyAddress: z.string().min(1, "Company Address is required"),
  city: z.string().min(1, "City is required"),
  companyPhone: z
    .string()
    .min(1, "Company Phone is required")
    .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format."),
});
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  rememberMe: z.boolean().optional(),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 chars."),
  email: z.string().email("Invalid email."),
  companyName: z.string().trim().min(1, "Company name required."),
  companyAddress: z.string().trim().min(1, "Company address required."),
  city: z.string().trim().min(1, "City required."),
  companyPhone: z
    .string()
    .trim()
    .regex(/^[+]?\d{10,15}$/i, "Invalid phone number."),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmNewPassword: z.string().min(8, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "Passwords do not match",
  });
export const verifyEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const SupplierSchema = z.object({
  supplierCode: z.string().min(2, {
    message: "Supplier code is required",
  }),
  companyName: z.string().min(2, {
    message: "Company name must be at least 2 characters.",
  }),
  contactPerson: z.string().min(2, {
    message: "Contact person name must be at least 2 characters.",
  }),
  email: optionalEmail(),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  address: z.string().min(5, "Address must be at least 5 characters."),
  city: z.string().min(1, "City is required"),
  isActive: z.boolean().default(true),
});

export const PurchaseFormSchema = z.object({
  supplierId: z.string().min(1, "Please select a supplier"),
  purchaseCode: z.string().min(1, "Purchase code is required"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  status: z.string().min(1, "Please select a status"),
  discount: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  productId: z.string().min(1, "Please select a product"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitCost: z.number().min(0, "Unit cost must be positive"),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  itemDiscount: z.number().min(0).optional(),
});

export const ProductSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  productCode: z.string().min(3, "Product code must be at least 3 characters"),
  category: z.string().min(1, "Please select a category"),
  unit: z.string().min(1, "Please select a unit"),
  brand: z.string().min(1, "Brand is required"),
  description: z.string().optional(),
  unitCost: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Unit cost must be a valid positive number",
    })
    .transform(Number),
  unitPrice: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Unit price must be a valid positive number",
    })
    .transform(Number),
  isActive: z.boolean().default(true),
});

export const CategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});
export const BrandSchema = z.object({
  organizationId: z.string().min(1, "Select organization"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export const CustomerSchema = z.object({
  customerCode: z.string().min(1, "Customer code is required"),
  name: z.string().min(1, "Name is required"),
  email: optionalEmail(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  creditLimit: z
    .string()
    .min(0, "Credit limit must be 0 or more")
    .transform(Number),
  isActive: z.boolean().default(true),
});
export const SaleInvoiceItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  productName: z.string().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
  totalPrice: z.number().min(0, "Total price must be non-negative"),
  taxPercent: z.number().optional(),
});

export const SaleInvoiceSchema = z.object({
  saleCode: z.string().min(1, "Sale code is required"),
  customerId: z.string().min(1, "Customer is required"),
  taxAmount: z.number().min(0, "Tax amount must be non-negative").optional(),
  discount: z.number().min(0, "Discount must be non-negative").optional(),
  status: z.enum(["Pending", "Completed", "Cancelled"]),
  saleItems: z
    .array(SaleInvoiceItemSchema)
    .min(1, "At least one sale item is required"),
});

export const ReturnItemSchema = z.object({
  productId: z.string().min(1, "Please select a product"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  taxAmount: z.number().min(0, "Tax amount must be positive"),
  discount: z.number().min(0, "Discount must be positive"),
  note: z.string().optional(),
});

export const ReturnFormSchema = z
  .object({
    saleId: z.string().optional(),
    returnDate: z.string().min(1),
    customerId: z.string().optional(),
    purchaseId: z.string().optional(),
    returnCode: z.string().min(3, "Return code must be at least 3 characters"),
    returnType: z
      .string()
      .refine(
        (value) => ["SALE", "PURCHASE", "EXPIRED", "DAMAGED"].includes(value),
        { message: "Please select a return type" }
      ),
    reason: z.string().optional(),
    items: z.array(ReturnItemSchema).min(1, "At least one item is required"),
  })
  .refine(
    (data) => {
      if (data.returnType === "SALE" && !data.saleId) {
        return false;
      }
      if (data.returnType === "PURCHASE" && !data.purchaseId) {
        return false;
      }
      return true;
    },
    {
      message: "Please select the appropriate invoice for the return type",
      path: ["saleId", "purchaseId"],
    }
  );

/**
 * Every form is typed as `useForm<TInput, any, TOutput>` so the value the form
 * holds (raw input strings) and the value the submit handler receives (parsed)
 * are both statically known.
 */
export type SignupFormInput = z.input<typeof SingupSchema>;
export type SignupFormOutput = z.output<typeof SingupSchema>;
export type SignupForm = z.infer<typeof SingupSchema>;

export type RegisterCompanyFormInput = z.input<typeof registerCompanySchema>;
export type RegisterCompanyFormOutput = z.output<typeof registerCompanySchema>;

export type LoginFormInput = z.input<typeof loginSchema>;
export type LoginFormOutput = z.output<typeof loginSchema>;

export type SupplierInput = z.input<typeof SupplierSchema>;
export type SupplierOutput = z.output<typeof SupplierSchema>;
export type Supplier = z.infer<typeof SupplierSchema>;

export type PurchaseFormInput = z.input<typeof PurchaseFormSchema>;
export type PurchaseFormOutput = z.output<typeof PurchaseFormSchema>;
export type PurchaseFormValues = z.infer<typeof PurchaseFormSchema>;

export type ProductInput = z.input<typeof ProductSchema>;
export type ProductOutput = z.output<typeof ProductSchema>;
export type Product = z.infer<typeof ProductSchema>;

export type CategoryInput = z.input<typeof CategorySchema>;
export type CategoryOutput = z.output<typeof CategorySchema>;
export type Category = z.infer<typeof CategorySchema>;

export type BrandInput = z.input<typeof BrandSchema>;
export type BrandOutput = z.output<typeof BrandSchema>;
export type Brand = z.infer<typeof BrandSchema>;

export type CustomerInput = z.input<typeof CustomerSchema>;
export type CustomerOutput = z.output<typeof CustomerSchema>;
export type CustomerFormData = z.infer<typeof CustomerSchema>;

export type SaleInvoiceItemInput = z.input<typeof SaleInvoiceItemSchema>;
export type SaleInvoiceInput = z.input<typeof SaleInvoiceSchema>;
export type SaleInvoiceOutput = z.output<typeof SaleInvoiceSchema>;
export type SaleInvoiceFormData = z.infer<typeof SaleInvoiceSchema>;

export type ReturnItemInput = z.input<typeof ReturnItemSchema>;
export type ReturnFormInput = z.input<typeof ReturnFormSchema>;
export type ReturnFormOutput = z.output<typeof ReturnFormSchema>;
export type ReturnFormValues = z.infer<typeof ReturnFormSchema>;

export type UpdatePasswordInput = z.input<typeof updatePasswordSchema>;
export type UpdatePasswordOutput = z.output<typeof updatePasswordSchema>;

export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileOutput = z.output<typeof profileSchema>;

