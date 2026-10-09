import { z } from "zod";
import { nullableText } from "../inputs";
import { paginationQuerySchema } from "../pagination";

/**
 * `organizationId` is deliberately not part of this schema.
 *
 * It was, and it was the one field the shared schema demanded that the
 * Prisma model did not: `addBrand` in src/services/brand.ts resolved the tenant
 * from `getCurrentUserActiveOrganizationId()` and overwrote whatever the form
 * sent, so a caller naming another organization got a brand in their own tenant
 * and a success message. The checkpoint 2i plan moves the value to the auth
 * context, and the schema stops accepting it.
 *
 * `categoryId` is the field that was actually missing. The shared schema had no
 * `categoryId` at all, while `Brand.categoryId` is a non-nullable foreign key,
 * so nothing built from this schema could create a valid brand: Prisma would
 * reject the row for a missing required column. It is required here, and not
 * blankable, because there is no null column to clear.
 *
 * `name` uniqueness is `@@unique([name, categoryId, organizationId])`, so the
 * same name is legal in two categories of one tenant and illegal twice in the
 * same one.
 */
const brandFields = {
  name: z.string().trim().min(1, "Name is required"),
  categoryId: z.string().min(1, "Select a category"),
  // Short code used to build a product's SKU (ADR 0007). Blank falls back to
  // the brand name's prefix at generation time, so it is clearable.
  shortCode: nullableText("Short code cannot be empty"),
  description: nullableText("Description cannot be empty"),
};

export const BrandSchema = z.object(brandFields);

export const BrandUpdateSchema = z.object(brandFields).partial();

export const brandListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  // Filters the list to one category. An empty value is rejected rather than
  // ignored: a dropdown that submits "" means "no category", and treating that
  // as "all categories" would quietly widen the result set.
  categoryId: z.string().min(1, "Category filter cannot be empty").optional(),
});

export type BrandInput = z.output<typeof BrandSchema>;

export type BrandUpdateInput = z.output<typeof BrandUpdateSchema>;

export type BrandListQuery = z.output<typeof brandListQuerySchema>;

export type BrandFormData = BrandInput;
