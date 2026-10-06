import { SaleItem, LowStockProduct, NotificationItem } from '../types/invenza';

/**
 * Seed values the dashboard and shell fall back to when the API has nothing to
 * show. Deliberately empty: a fresh install starts blank rather than with
 * invented invoices, and everything below is what a real request replaces.
 */
export const initialSales: SaleItem[] = [];

export const initialLowStock: LowStockProduct[] = [];

export const initialNotifications: NotificationItem[] = [];
