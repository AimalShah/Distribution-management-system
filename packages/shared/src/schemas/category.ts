import { z } from "zod";
import { nullableText } from "../inputs";
import { paginationQuerySchema } from "../pagination";

/**
 * Shared by create and update so both agree on what a blank field means.
 *
 * `description` is blank-to-null rather than blank-to-undefined because Prisma
 * reads `undefined` as "leave this column alone". The legacy update wrote
 * `...(data.description && { description: ... })`, and an empty string is
 * falsy, so clearing the box dropped the key and left the old description in
 * place with a success message. Clearing it now clears it.
 */
const categoryFields = {
  name: z.string().trim().min(1, "Name is required"),
  description: nullableText("Description cannot be empty"),
};

export const CategorySchema = z.object(categoryFields);

export const CategoryUpdateSchema = z.object(categoryFields).partial();

export const categoryListQuerySchema = paginationQuerySchema.extend({
  // An empty search box is not an error: it trims to "" and the service reads
  // that as "no filter".
  search: z.string().trim().optional(),
});

export type CategoryInput = z.output<typeof CategorySchema>;
export type CategoryUpdateInput = z.output<typeof CategoryUpdateSchema>;
export type CategoryListQuery = z.output<typeof categoryListQuerySchema>;
export type CategoryFormData = CategoryInput;
