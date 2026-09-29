# Checkpoint 1 — Shared Packages: Source Review

## Source Review

### `prisma/schema.prisma` (415 lines)

**Models (17):** User, Session, Account, Verification, Organization, Member, Invitation, Supplier, Customer, Product, Purchase, PurchaseItem, Sale, SaleItem, Category, Brand, Inventory, InventoryLog, Return, ReturnItem

**Enums:** InventoryMovement (IN, OUT, ADJUSTMENT, TRANSFER, RETURN, DAMAGED, EXPIRED), ReturnType (SALE, PURCHASE, EXPIRED, DAMAGED)

**Key relationships:**
- Organization → User (via Member)
- Organization → Supplier, Customer, Product, Category, Brand, Inventory, Purchase, Sale, Return
- Product → Category, Brand
- Purchase → Supplier, PurchaseItem → Product
- Sale → Customer, SaleItem → Product
- Inventory → Product (unique), InventoryLog → Inventory
- Return → ReturnItem → Product

**Notable schema details:**
- `Inventory.productId` is `@unique` — one inventory record per product
- `Category` has unique constraint on `name + organizationId`
- `Brand` has unique constraint on `name + categoryId + organizationId`
- `PurchaseItem` has `batchNumber`, `expiryDate`, `taxPercent`, `discount` fields
- `SaleItem` has `taxPercent`, `discount` fields
- `Customer` has `creditLimit` field
- All models have `organizationId` for multi-tenancy

### `src/validations/schemas.ts` (279 lines)

**Exported Zod schemas:**

| Schema | Key Fields |
|--------|------------|
| `SingupSchema` | name, email, password (min 8) |
| `registerCompanySchema` | companyName, companySlug, companyAddress, city, companyPhone |
| `loginSchema` | email, password, rememberMe? |
| `profileSchema` | name, email, companyName, companyAddress, city, companyPhone, avatarUrl? |
| `updatePasswordSchema` | currentPassword, newPassword, confirmNewPassword (refined to match) |
| `verifyEmailSchema` | email |
| `SupplierSchema` | supplierCode, companyName, contactPerson, email?, phone, address, city, isActive |
| `PurchaseFormSchema` | supplierId, purchaseCode, purchaseDate, status, discount?, taxAmount?, productId, quantity, unitCost, batchNumber?, expiryDate?, taxPercent, itemDiscount? |
| `ProductSchema` | name, productCode, category, unit, brand, description?, unitCost, unitPrice, isActive |
| `CategorySchema` | name, description? |
| `BrandSchema` | organizationId, name, description? |
| `CustomerSchema` | customerCode, name, email?, phone?, address?, city?, creditLimit, isActive |
| `SaleInvoiceItemSchema` | productId, productName?, quantity, unitPrice, totalPrice, taxPercent? |
| `SaleInvoiceSchema` | saleCode, customerId, taxAmount?, discount?, status, saleItems (min 1) |
| `ReturnItemSchema` | productId, quantity, unitPrice, taxAmount, discount, note? |
| `ReturnFormSchema` | saleId?, returnDate, customerId?, purchaseId?, returnCode, returnType, reason?, items (min 1) |

**Notable validation details:**
- `ReturnFormSchema` uses `.refine()` — SALE returns require `saleId`, PURCHASE returns require `purchaseId`
- `PurchaseFormSchema` has nested item validation with `taxPercent` (0-100) and optional `batchNumber`/`expiryDate`
- `ProductSchema` uses `z.string().transform()` for `unitCost` and `unitPrice` (string → number)
- `CustomerSchema` uses `z.string().transform()` for `creditLimit`

### `src/components/ui/` (30 shadcn components)

Standard shadcn/ui components built on Radix UI primitives:
accordion, alert, avatar, badge, button, calendar, card, chart, checkbox, date-range, dialog, dropdown-menu, form, input, label, popover, progress, select, separator, sheet, sidebar, skeleton, sonner, switch, table, tabs, textarea, tooltip

All are CLI-installed shadcn components with standard shadcn patterns (cva for variants, Radix primitives, Tailwind classes).
