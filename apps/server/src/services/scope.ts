import type { Prisma } from "@dms/db";

/**
 * What "active, in-tenant, in-window, in-brand" means for a query.
 *
 * One module owns the rule so a new exclusion is a line here instead of a sweep
 * across the three report modules and the customer ledger. A caller hands over
 * the tenant, a window and an optional brand, and gets back the `where`
 * fragment; the field names the rule is written against — `deletedAt`,
 * `organizationId`, `brandId`, and the relation hops a row without a tenant
 * column needs — live only in this file. What stays with the caller is the
 * measure: which columns are summed, which keys are grouped on, and filters
 * that select a *kind* of row rather than its scope (`movementType` on a
 * movement log, `returnType` on a credit).
 *
 * Soft delete is a product rule (CONTEXT.md): a row carrying a `deletedAt`
 * stamp is out of circulation until it is restored, so every scope below
 * excludes those rows and no call site restates it. `notSoftDeleted` carries
 * the rule on its own for a count whose whole scope is that one rule.
 *
 * Only `Sale`, `Return` and `Payment` have a `deletedAt` column in the schema.
 * `Purchase`, `Inventory`, and the rows behind them have no such column, and
 * their scopes deliberately say nothing about one.
 *
 * Consumers: `services/reports/sales-report.ts`, `services/reports/purchase-report.ts`,
 * `services/reports/inventory-report.ts`, and the customer ledger in
 * `services/customer.ts`.
 */

/**
 * Comparisons for a document's date column. Which column they land on, and
 * whether an empty bound leaves the key out of the query entirely, is the
 * scope's business — never the caller's.
 */
export interface DateBound {
  gte?: Date;
  lte?: Date;
  lt?: Date;
}

/** The window shape every report query carries: both ends optional, each end at the timestamp it was given. */
export interface ReportWindowQuery {
  startDate?: Date | null;
  endDate?: Date | null;
}

/** Everything a scope can be given: the tenant, a window, an optional brand. */
export interface ScopeInput {
  organizationId: string;
  window?: DateBound;
  brandId?: string | null;
}

/** A row that carries its tenant itself, with no window and no brand of its own. */
export interface TenantScopeInput {
  organizationId: string;
}

/** The tenant plus an optional window, for a dated row that has no brand: a movement log, a return, a payment. */
export interface WindowScopeInput {
  organizationId: string;
  window?: DateBound;
}

/** The tenant plus an optional brand, for a row that *is* a product. */
export interface BrandScopeInput {
  organizationId: string;
  brandId?: string | null;
}

/** A line of a document: the document's scope, plus the grain the brand is asked at. */
export interface LineScopeInput extends ScopeInput {
  /**
   * Require the line's *own* product to carry the brand, not merely an invoice
   * that contains it somewhere. A report grouped by product wants this grain; a
   * report totalling every line of an in-window invoice does not, and for an
   * invoice spanning brands the two answers differ.
   */
  brandOnLine?: boolean;
}

/**
 * The soft-delete rule on its own. Spread into a scope, or used as the whole
 * `where` of a count whose scope is nothing else — the customer list's invoice
 * badge, which reads the rows of one customer through a relation that is
 * already theirs.
 */
export const notSoftDeleted = { deletedAt: null };

/**
 * A report window: each end at the timestamp it was given, each end inclusive,
 * each one left out when it was not asked for. A bound with no comparison must
 * leave the column's key out of the query rather than enter it as `{}` — an
 * unfiltered report that silently filtered on nothing is the bug this shape
 * exists to make impossible.
 */
export const reportWindow = ({ startDate, endDate }: ReportWindowQuery): DateBound => {
  const bound: DateBound = {};

  if (startDate) {
    bound.gte = startDate;
  }

  if (endDate) {
    bound.lte = endDate;
  }

  return bound;
};

/**
 * A statement window: `from` inclusive of its own instant, `to` inclusive of
 * the whole calendar day it names — a statement "as of 6 October" has to
 * include the invoices and receipts of the 6th, and a date that arrives as UTC
 * midnight would otherwise cut the day off at 00:00. A bound with a time of day
 * already is taken at face value.
 */
export const statementWindow = (from?: Date | null, to?: Date | null): DateBound => {
  const bound: DateBound = {};

  if (from) {
    bound.gte = from;
  }

  if (to) {
    bound.lt = upperExclusive(to);
  }

  return bound;
};

/** Everything strictly before a point: the opening balance a statement reads before its window opens. */
export const beforeWindow = (at: Date): DateBound => ({ lt: at });

/**
 * The first instant after `to`'s calendar day, so a `<` bound includes that
 * day whole. Midnight is the whole day's start; anything else is already a
 * point in time and moves by the smallest step that makes it exclusive.
 */
const upperExclusive = (to: Date): Date =>
  to.getTime() % 86_400_000 === 0
    ? new Date(to.getTime() + 86_400_000)
    : new Date(to.getTime() + 1);

/** An unbounded window carries no comparison, and a filter with none would still put the column's key in the query. */
const hasBound = (window?: DateBound): window is DateBound =>
  window !== undefined && Object.keys(window).length > 0;

/**
 * An active sale in this tenant, in this window, of this brand — the document
 * grain: a brand filter admits an invoice that *contains* the brand.
 */
export const saleScope = ({ organizationId, window, brandId }: ScopeInput): Prisma.SaleWhereInput => {
  const where: Prisma.SaleWhereInput = { organizationId, ...notSoftDeleted };

  if (hasBound(window)) {
    where.saleDate = window;
  }

  if (brandId) {
    where.items = { some: { product: { brandId } } };
  }

  return where;
};

/**
 * Lines of an in-scope sale. `SaleItem` has no tenant column and no date of
 * its own, so both are reached through the invoice; with `brandOnLine` the
 * brand is additionally required of the line's own product.
 */
export const saleItemScope = ({ organizationId, window, brandId, brandOnLine }: LineScopeInput): Prisma.SaleItemWhereInput => {
  const where: Prisma.SaleItemWhereInput = { sale: saleScope({ organizationId, window, brandId }) };

  if (brandOnLine && brandId) {
    where.product = { brandId };
  }

  return where;
};

/** An in-tenant purchase in this window, of this brand — the document grain, through the purchase's items. */
export const purchaseScope = ({ organizationId, window, brandId }: ScopeInput): Prisma.PurchaseWhereInput => {
  const where: Prisma.PurchaseWhereInput = { organizationId };

  if (hasBound(window)) {
    where.purchaseDate = window;
  }

  if (brandId) {
    where.purchaseItems = { some: { product: { brandId } } };
  }

  return where;
};

/**
 * Lines of an in-scope purchase, as `saleItemScope` for a sale: the tenant and
 * window arrive through the order, `brandOnLine` puts the brand on the line's
 * own product.
 */
export const purchaseItemScope = ({ organizationId, window, brandId, brandOnLine }: LineScopeInput): Prisma.PurchaseItemWhereInput => {
  const where: Prisma.PurchaseItemWhereInput = { purchase: purchaseScope({ organizationId, window, brandId }) };

  if (brandOnLine && brandId) {
    where.product = { brandId };
  }

  return where;
};

/** An active return in this tenant and window. Brand reaches a return only through its invoice; no consumer asks yet, so the line to add it is here. */
export const returnScope = ({ organizationId, window }: WindowScopeInput): Prisma.ReturnWhereInput => {
  const where: Prisma.ReturnWhereInput = { organizationId, ...notSoftDeleted };

  if (hasBound(window)) {
    where.returnDate = window;
  }

  return where;
};

/** An active payment in this tenant and window. */
export const paymentScope = ({ organizationId, window }: WindowScopeInput): Prisma.PaymentWhereInput => {
  const where: Prisma.PaymentWhereInput = { organizationId, ...notSoftDeleted };

  if (hasBound(window)) {
    where.paidAt = window;
  }

  return where;
};

/** A product of this tenant, optionally of this brand. */
export const productScope = ({ organizationId, brandId }: BrandScopeInput): Prisma.ProductWhereInput => {
  const where: Prisma.ProductWhereInput = { organizationId };

  if (brandId) {
    where.brandId = brandId;
  }

  return where;
};

/**
 * The rows that carry their tenant on themselves and nothing else — the shape a
 * second scoped query takes when a group key has to be resolved to a display
 * field. One place to add a rule such as "lookups skip archived rows" rather
 * than one per report.
 */
export const customerScope = ({ organizationId }: TenantScopeInput): Prisma.CustomerWhereInput => ({
  organizationId,
});

/** The same tenant-only scope for a supplier name lookup. */
export const supplierScope = ({ organizationId }: TenantScopeInput): Prisma.SupplierWhereInput => ({
  organizationId,
});

/** The tenant's stock rows: no date, no brand — `Inventory` is the present state, not a period. */
export const inventoryScope = ({ organizationId }: TenantScopeInput): Prisma.InventoryWhereInput => ({
  organizationId,
});

/**
 * Movements of this tenant's stock. `InventoryLog` has no tenant column, so it
 * is reached through the row it moved — `inventory: { organizationId }` is this
 * module's knowledge, not the caller's.
 */
export const inventoryLogScope = ({ organizationId, window }: WindowScopeInput): Prisma.InventoryLogWhereInput => {
  const where: Prisma.InventoryLogWhereInput = { inventory: { organizationId } };

  if (hasBound(window)) {
    where.createdAt = window;
  }

  return where;
};

/** This tenant's batches. */
export const stockBatchScope = ({ organizationId }: TenantScopeInput): Prisma.StockBatchWhereInput => ({
  organizationId,
});
