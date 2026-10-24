# Operations Matrix

Every mutating operation in the DMS, what it must do in full, and its test
coverage. Generated from a read of `apps/server/src/routes/*`,
`apps/server/src/services/*` and `apps/web/src` (see "Sources").

Legend: **side effects** are the consequences that must hold in the DB (not just
a `200`), **UI** names the component the user presses, **API** names the called
endpoint. Coverage status is from the suites listed in the last section.

`org` = tenant scoping (`organizationId` from the session's active org).
`ledger` = `InventoryLog` movement row. Money precision is 2-decimal throughout.

---

## 1. Sales

| Operation | API | UI entry | Tables touched | Side effects that must hold | Coverage |
|---|---|---|---|---|---|
| Create sale | `POST /api/sales` (`sale.ts` route → `createSale` `services/sale.ts`) | `SaleInvoiceForm.tsx:2:265` | Sale, SaleItem(+batchId), Inventory, InventoryLog, StockBatch | ① Stock out per line, FEFO, guarded (refuses negative). One ledger row per product with before/after. ② Totals derived server-side from `taxPercent` rates: `total = Σline − discount`, tax split CGST+SGST (intra) or IGST (inter) summing to `taxAmount`. ③ `amountPaid` stays 0. ④ Credit-limit soft block: exceed warns, override gated by permission. ⑤ Customer balance ledger (derived) rises by total. ⑥ Cache invalidated. | ✅ existing guards + parity; ❌ **MISSING: property-style money-math suite, no-reload UI suite** |
| Update sale (header/status/discount/inter-state) | `PUT /api/sales/:id` | `SaleInvoiceForm.tsx:243` | Sale, (rereads SaleItem, Product) | Lines not editable; discount/inter-state flips recompute total+tax+splits from stored rows. Stock untouched. | partial (parity); ⚠️ product read at `sale.ts:584–586` by bare id, no org filter — flagged |
| Cancel sale | `POST /api/sales/:id/cancel` | `SaleInvoiceList.tsx:230` | Sale, Return(count) | Goods stay OUT (documented: cancel ≠ delete). Refused with payments/returns. Balance derivation must exclude `status=Cancelled`. Not transactional (read+update). | existing; ⚠️ see flag F-9 |
| Un-cancel | `POST /api/sales/:id/uncancel` | `SaleInvoiceList.tsx:246` | Sale | Restores `statusBeforeCancel`. | existing only |
| Delete sale (soft) | `DELETE /api/sales/:id` | `SaleInvoiceList.tsx:195` | Sale(+deletedAt), Inventory, InventoryLog, StockBatch, Return(count) | Stock back IN per line (same mechanism as return), refused when payments or active returns exist. Serializable. | existing |
| Restore sale | `POST /api/sales/:id/restore` | `SaleInvoiceList.tsx:211` | Sale, Inventory,… | Stock out again, availability-checked (refused, never clamped). | existing |

## 2. Payments & credit

| Operation | API | UI entry | Tables touched | Side effects that must hold | Coverage |
|---|---|---|---|---|---|
| Record payment (to invoice) | `POST /api/payments` | `RecordPaymentDialog.tsx:128`, `PaymentsPage.tsx:173` | Payment, Sale.amountPaid | `Sale.amountPaid += amount` under a guarded conditional update (`amountPaid ≤ totalAmount − amount`) — over-pay refused, concurrent-safe. Refused on deleted/cancelled/foreign-customer invoice. Customer balance (derived) falls by amount. | existing; ❌ **MISSING: balance-invariant + store-credit + concurrency suite** |
| Record payment (cash on account, no sale) | `POST /api/payments` | same | Payment | No `amountPaid` change; ledger shows receipt; balance falls. | ❌ missing |
| Store-credit payment | `POST /api/payments` (`method: "Store Credit"`) | same | Payment, Sale.amountPaid | Allowed up to accumulated SALE-return credits minus prior store-credit payments. Credits are computed from `ReturnItem` rows — figures are server-derived since F-1's fix (`278f0cd`). | ❌ missing (currently banked from client) |
| Correct (delete) payment | `DELETE /api/payments/:id` | `PaymentsPage.tsx:191` | Payment(+deletedAt), Sale.amountPaid | Guarded decrement, refused underflow. ⚠️ **UI bug G-4: no cross-surface invalidation** — sales rows, ledger, dashboard stay stale. | ❌ missing |

## 3. Returns (priority)

| Operation | API | UI entry | Tables touched | Side effects that must hold | Coverage |
|---|---|---|---|---|---|
| Create sale return | `POST /api/returns` (`returnType SALE`) | `ReturnForm.tsx:217` | Return, ReturnItem, Inventory, InventoryLog, StockBatch, (Sale, CompanySettings, Return[]) | ① Stock IN per product, **only `RESTOCKABLE` lines** (ADR 0008 gate); damaged lines credited but never restocked. ② Credit amount = `qty×unitPrice + taxAmount − discount` per line, **proportional to the returned quantity, tax and discount derived from the ORIGINAL invoice line server-side**. ③ Refuses window > 30d, over-return vs cumulative returned qty, foreign tenant, product not on document, deleted invoice. Serializable. ④ Customer balance falls by credit. ⑤ Store-credit pool grows by credit. ⑥ Dashboard outstanding falls. | ❌ **MISSING (bugs F-1, F-2, F-8, F-9, F-10 found)** |
| Create purchase return | `POST /api/returns` (`returnType PURCHASE`) | same | Return, ReturnItem, Inventory, InventoryLog, StockBatch | Stock OUT (guarded, refused if insufficient), headroom vs purchase lines + prior returns, optional `purchaseId` (⚠️ F-7). **No supplier-payable ledger exists — see flag F-5.** | ❌ missing |
| Create write-off (EXPIRED/DAMAGED) | `POST /api/returns` | same | Return, ReturnItem, Inventory, InventoryLog, StockBatch | Stock OUT, no document link. | partial (batch expiry) |
| Delete (soft) return | `DELETE /api/returns/:id` | `ReturnList.tsx:98` | Return(+deletedAt), Inventory, InventoryLog | Reverses the movement (opposite direction reversed), refused if goods already sold on; headroom given back. Serializable. | existing |
| Restore return | `POST /api/returns/:id/restore` | `ReturnList.tsx:117` | Return, Inventory, InventoryLog | Re-applies original movement, re-checks headroom + availability. Serializable. | existing |
| Idempotency (double submit) | `POST /api/returns` | — | Return | Same `returnCode` twice → one row (unique ⚠️ **global** unique, cross-tenant collision possible — F-6). | ❌ missing |
| Concurrency (two returns racing) | `POST /api/returns` | — | Return, Inventory | `Serializable` — exactly one of two over-returning calls wins; stock stays ≤ sold. P2034 → 409. | ❌ missing |

## 4. Purchases

| Operation | API | UI entry | Tables touched | Side effects that must hold | Coverage |
|---|---|---|---|---|---|
| Create purchase | `POST /api/purchases` | `PurchaseForm.tsx:208` | Purchase, PurchaseItem, Inventory, InventoryLog, StockBatch | Total recomputed server-side (`calculatePurchaseTotal`), tax from line rates. Stock IN + batch upsert (batchNumber/expiry/unitCost) for **every** status incl. `'Pending'` ⚠️ F-8. ① Tenant: products verified; supplier NOT verified in-org ⚠️ F-3. ② Cache invalidated. | existing; ❌ MISSING: status-vs-stock, supplier-scope assertions |
| Update purchase (discount) | `PUT /purchases/:id` | `PurchaseForm.tsx:187` | Purchase, PurchaseItem(read) | total recomputed; ⚠️ **not transactional** (recompute reads outside tx) — F-4. Items not editable. | existing |
| Delete purchase | `DELETE /purchases/:id` | `PurchaseList.tsx:102` | Purchase (**hard delete**), PurchaseItem, Inventory, InventoryLog, StockBatch, Return(count) | Stock back OUT (guarded), refuses active returns/shortage. Only non-soft document delete — audit trail gap ⚠️ F-11. | existing |

## 5. Inventory & stock

| Operation | API | UI entry | Tables touched | Side effects that must hold | Coverage |
|---|---|---|---|---|---|
| Create inventory record (opening) | `POST /api/inventory` | `AddInventoryDialog/Form.tsx:71/105` | Inventory, InventoryLog, StockBatch | `quantityOnHand` is a client figure by design (opening count); ledger row only when > 0 ⚠️ F-12. | existing |
| Stock adjustment / correction | `POST /api/inventory/adjust` | `AdjustStockDialog.tsx:85` | Inventory, InventoryLog, StockBatch | IN/RETURN in; OUT/DAMAGED/EXPIRED out guarded; ADJUSTMENT = absolute count (signed delta in ledger). **`TRANSFER` refused — no transfer modeling** (PRD: single location, documented). | existing |
| Bulk CSV import | `POST /api/inventory/bulk-import` | `AddInventoryForm.tsx:194` | Inventory (upsert) | ⚠️ **F-13: `quantityOnHand` set absolutely from client with NO `InventoryLog` row — bypasses the movement ledger**, so reconciliation cannot hold for imported rows. | ❌ missing |
| Inventory settings | `PUT /inventory/:id/settings` | `AddInventoryForm` | Inventory | reorder/max levels; not transactional (single update, ok). | existing |

## 6. Master data

| Operation | API | UI | Tables | Side effects | Coverage |
|---|---|---|---|---|---|
| Create product | `POST /api/products` | `ProductForm.tsx:244` | Product, CompanySettings(SKU sequence), Category/Brand verify | SKU generated from company format (or client `productCode` honored ⚠️); refs verified in-org. Not transactional (sequence upsert outside) ⚠️. | existing |
| Edit product | `PUT /products/:id` | `ProductForm.tsx:240` | Product | refs re-verified. | existing |
| Delete product | `DELETE /products/:id` | `ProductList.tsx:117` | Product (**hard delete**) | ⚠️ F-14: no in-use guard (DB FK decides) — deleting a sold-to product still works if inventory row absent; audit-trail gap. | existing |
| Customer create/edit | `POST|PUT /api/customers` | `CustomerDialog.tsx:127/123` | Customer | all fields verbatim (business data), org scoped. | existing |
| Customer delete | `DELETE /customers/:id` | `CustomerList.tsx:92` | Customer | refuses with sales/payments history. | existing |
| Supplier create/edit/delete | `POST|PUT|DELETE /api/suppliers` | Suppliers form | Supplier | delete refuses with purchase history. | existing |
| Category / Brand CRUD | `POST|PUT|DELETE /api/categories, /brands` | `ProductForm` quick-creates, `BrandManager` | Category, Brand, Product | deletes refuse when in use. ⚠️ **G-5**: quick-create + `BrandManager` mutations only revalidate their own keys — sibling surfaces (reports page) go stale. | existing; ❌ UI freshness |
| Company settings | `PUT /api/settings` | `CompanySettingsPage.tsx:154` | CompanySettings | Affects return window, credit terms, SKU format; clears settings cache. | existing |

## 7. Tenancy / auth surface

| Operation | API | UI | Side effects | Coverage |
|---|---|---|---|---|
| Switch organization | `POST /api/organizations/set-active` | `CompanySwitcher.tsx:42` | Session.activeOrganizationId set; member re-checked per request | ⚠️ **G-2: no pending state** — second click races; failure only `console.error`. On switch every SWR key revalidates. | ❌ missing (first-paint stale-row test) |
| Create org | `POST /api/organizations` | `CreateCompanyDialog:95`, Onboarding | Organization, Member(owner), User.organizationId | transactional | existing |
| Edit org / settings | `PATCH /organizations/:id` | `EditCompanyDialog` | Organization, CompanySettings | owner/admin in *that* org required | existing |
| Members/roles CRUD | `/api/members`, `/api/roles` | `UsersPage`, `PermissionPage` | Member, Role, RolePermission | owner-grant + last-owner guards, Serializable on role writes | existing |
| Sign in/out | better-auth | login page | Session, User | rate-limit + lockout-never-lockout | existing |

---

## Lists to exclude from tenant-B reads (Phase 2 tenancy suite)

`GET /products`, `/products/:id`, `/customers`, `/customers/:id`,
`/customers/:id/ledger`, `/suppliers`, `/suppliers/:id`, `/purchases`,
`/purchases/:id`, `/sales`, `/sales/:id`, `/returns`, `/returns/:id`,
`/payments`, `/payments/:id`, `/inventory`, `/inventory/:id`,
`/inventory/logs`, `/inventory/batches`, `/dashboard/stats`, `/reports/*` —
tenant A must never see or mutate tenant B's rows (404/403/code).

---

## Flags: missing or suspicious side effects

| # | Where | Suspicion |
|---|---|---|
| **F-1** ✅ fixed (`278f0cd`) | `services/return.ts` (`documentItemMoney`/`writeOffItemMoney`) | `ReturnItem.unitPrice`, `taxAmount`, `discount` were banked **verbatim from the client payload** and drove the store-credit math (`payment.ts:96–147`), the customer ledger credit (`customer.ts:293–299`) and dashboard Outstanding. Now derived server-side from the document's own figures (stored GST split, header discount share, returnedQty/docQty proration, 2dp), weighted across lines per product; write-offs keep client figures. Schema money fields relaxed to optional. Pinned by `qa/domain/returns.test.ts` (18/18). |
| **F-2** ✅ fixed (`35abc71`) | `services/return.ts` (SALE branch) | A SALE return only checked `deletedAt: null` on the invoice — a `Cancelled` invoice was still returnable, though payments against it are refused (`payment.ts:179`). The SALE branch now refuses a cancelled invoice with 409 `SALE_CANCELLED`, mirroring the payment rule. |
| **F-3** ✅ fixed (`b45e5fc`) | `services/purchase.ts:217` | `Purchase.supplierId` was minted without an in-org verification. Now verifies supplier exists in organization before creating purchase, refusing foreign suppliers with 400 `SUPPLIER_NOT_IN_ORGANIZATION`. Pinned by `qa/domain/purchases.test.ts`. |
| **F-4** | `services/purchase.ts:276–343` | `updatePurchase` recompute reads run outside a transaction — discount change under a concurrent write lands on a read that may be stale. |
| **F-5** | (absent) | No supplier-payable ledger exists at all: purchase returns reduce stock but nothing records the vendor credit (Supplier Statement concept in `CONTEXT.md` has no backing aggregate). Return credit is only derivable from `Return` rows by code. Deferred: no AP model — flagged, not tested. |
| **F-6** | `schema.prisma` Sale 307 / Purchase 353 / Return 528 / Payment 606 | Document codes (`saleCode`, `returnCode`, …) are `@unique` **globally, not per org** — org B cannot reuse an org A code; conversely idempotent double-submit protection relies on this global constraint (a P2002 → 409). |
| **F-7** | `services/return.ts:348–378` | A PURCHASE return's headroom check runs only `if purchaseId` — the schema requires it, but the schema is client-side validation only at the route; the service also honors a payload that bypasses it without any document (arbitrary stock out). Defence-in-depth gap. |
| **F-8** | `services/purchase.ts:223–262` | Stock is added for a purchase in **any** client-supplied `status` (`'Pending'`/'Received'): goods are put on hand at PO-entry time, with no receipt step. Suspicious modeling; assumed intentional (documented purchase flow books receipts on entry). |
| **F-9** | `services/sale.ts` cancel | Cancel intentionally leaves stock deducted (goods gone) while balance/report math excludes the invoice — inventory on hand and money disagree for cancelled invoices by design. Documented tradeoff; matrix records it, tests assert the *balance* exclusion. |
| **F-10** ✅ fixed (`db910a8`) | `services/inventory.ts:195–275` | `bulkImportInventory` modified `quantityOnHand` with no `InventoryLog` row. Now routes through `applyStockMovement` with `movementType: "ADJUSTMENT"`, logging all movements for audit trail and reconciliation. Pinned by `qa/domain/inventory.test.ts`. |
| **F-11** ✅ fixed (`b45e5fc`) | `services/purchase.ts:429` | Purchase delete previously hard-deleted the row. Now soft-deletes with `deletedAt: new Date()` stamp and migration, preserving document history for audit trail and reconciliation. Pinned by `qa/domain/purchases.test.ts`. |
| **F-12** ✅ fixed (`eb6139c`) | `services/sale.ts:584–586` | `updateSale`/`deriveSaleMoney` read `Product` by bare id without org filter. Now scopes query with `organizationId` and verifies all product IDs belong to the tenant, refusing foreign products with 400 `PRODUCT_NOT_IN_ORGANIZATION`. Pinned by `qa/domain/isolation.test.ts`. |
| **F-13** | (server-wide) | No idempotency layer; double-submit safety rides on the client-generated unique `returnCode` (accidental). The UI generates a fresh code per attempt in some paths — a retry re-posts a new code → duplicate return (see Phase 4 double-submit scenario). |
| **F-14** ✅ fixed (`0a140ae`) | (web) | Zero optimistic updates previously in `apps/web` (SWR). List pages (`ProductList`, `SaleInvoiceList`, `ReturnList`, `PurchaseList`, `CustomerList`, `SupplierList`) now apply optimistic mutations on delete/restore/cancel. Pinned by `ProductList.test.tsx`. |

## UI flags (wiring, fixes in Phase 4)

| # | Where | Gap |
|---|---|---|
| G-1 ✅ fixed (`0a140ae`) | all of `apps/web` | List pages (`ProductList`, `SaleInvoiceList`, `ReturnList`, `PurchaseList`, `CustomerList`, `SupplierList`) now apply optimistic mutations on delete/restore/cancel without waiting for network round-trip. |
| G-2 ✅ fixed (`07132dc`) | `CompanySwitcher.tsx:40–48` | Org switch now has busy state (`switchingOrgId`), disables switching during in-flight requests, adds spinner to trigger button, and displays error toast via `failureMessage`. Pinned by `CompanySwitcher.test.tsx`. |
| G-3 ✅ fixed (`9d19b95`) | `PaymentsPage.tsx:186–200` | Delete-payment now calls `invalidateDomains("payments")` with optimistic removal, refreshing sales `amountPaid`, customer ledgers, and dashboard metrics. Pinned by `PaymentsPage.test.tsx`. |
| G-4 ✅ fixed (`769abc7`) | `ProductForm.tsx:167/203`, `BrandManager.tsx:37/69` | Category and brand quick-create and updates now route through `invalidateDomains("categories")` and `invalidateDomains("brands")`, invalidating related products and reports. Pinned by `BrandManager.test.tsx`. |
| G-5 ✅ fixed (`560e7bb`) | `OnboardingPage.tsx:145–149` | Pick-org buttons now have busy state (`selectingOrgId`), disable buttons during in-flight switches, and display a spinner. Pinned by `OnboardingPage.test.tsx`. |
| G-6 ✅ fixed (`5733fda`) | `ReturnForm.tsx` | Return form estimated value froze mid-session: `form.watch('items')` in the render body is lazy and Controller input changes publish only `{name,type}`, never re-rendering the footer. Replaced with `useWatch`; document-backed line money derived once and shared by rows/footer/payload (`documentItemMoney` semantics). |
| G-7 ✅ fixed (`3d557dc`) | `ReturnList.tsx`, `services/return.ts` | Returns list showed the line count (`_count.items`) labeled pcs — "returned 12 → 1 pcs". List service now computes a grouped piece sum (`items._sum.quantity`) and the column shows true pieces with line count as annotation. |
