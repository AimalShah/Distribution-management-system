# Salesman commission, order bookers, and tiered pricing

In distribution businesses (such as beverage distribution), field sales operate through two distinct roles:
1. **Order Bookers** who visit retail shops to take orders (managed as lightweight staff records without software logins).
2. **Salesmen** who fulfill and deliver stock (authenticated users in the system).

Additionally, market prices fluctuate and vary between **Retail** and **Wholesale** buyers, and salesmen earn incentives calculated on volume (commission per pack sold).

### Decisions

1. **Invoice Attribution**:
   - Each `Sale` belongs to a `Customer` (the buyer/retailer).
   - Each `Sale` records a required `salesmanId` (referencing `User`/`Member`). Defaults to the current user if they are a salesman.
   - Each `Sale` records an optional `orderBookerId` (referencing an `OrderBooker` record).

2. **Order Booker Entity**:
   - A dedicated `OrderBooker` model scoped to `Organization` with `id`, `name`, `phone`, `code`, and `isActive`.
   - Managed directly by staff inside the **Team / Users** surface without login credentials or email invitations.

3. **Tiered & Dynamic Product Pricing**:
   - `Product` gains explicit `retailPrice` and `wholesalePrice` fields (defaulting from existing `unitPrice`).
   - `Sale` gains a `pricingTier` field (`"retail"` | `"wholesale"`).
   - Selecting a product on an invoice auto-fills the price matching the chosen tier, but line-item unit prices remain fully operator-editable.

4. **Salesman Commission**:
   - Invoices do not compute or print commission; invoice totals remain customer-facing only.
   - Commission is managed in the **Team / Members** section under a salesman's summary view.
   - The admin selects a date range, the system aggregates total packs sold across completed sales for that salesman, and the admin inputs a `commissionPerPack` rate to calculate `Total Packs × Rate`.

**Consequences:**
- `Sale` schema adds `salesmanId`, `orderBookerId`, and `pricingTier`.
- `Product` schema adds `retailPrice` and `wholesalePrice`.
- New `OrderBooker` schema and API routes (`/order-bookers`).
- New Team tab for Order Bookers and a Salesman Commission Calculator dialog/tab.

**Status:** accepted
