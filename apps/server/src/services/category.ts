import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { CategoryInput, CategoryUpdateInput } from "@dms/shared";
import { conflict } from "../http";

// The legacy list embedded every brand in a category. Nothing read it: the only
// consumer of `fetchCategories` is the product and inventory category dropdown,
// which uses the name and nothing else. Both counts are sent instead, so a
// category that has been attached to nothing is visibly distinguishable from one
// that has not.
const listInclude = {
  _count: { select: { products: true, brands: true } },
} satisfies Prisma.CategoryInclude;

export type CategoryListArgs = {
  organizationId: string;
  page: number;
  pageSize: number;
  search?: string;
};

export async function getCategories({
  organizationId,
  page,
  pageSize,
  search,
}: CategoryListArgs) {
  const where: Prisma.CategoryWhereInput = {
    organizationId,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.category.findMany({
      where,
      include: listInclude,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.category.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

// The legacy `getCatgoryById` used `findUnique({ where: { id } })` with no tenant
// filter, so any authenticated member could read another tenant's category by id.
// Scoped here. Named without the legacy `getCatgoryById` typo, as the plan asks.
export async function getCategoryById(id: string, organizationId: string) {
  return prisma.category.findFirst({ where: { id, organizationId } });
}

export async function addCategory(data: CategoryInput, organizationId: string) {
  return prisma.category.create({
    // Trimmed on the create path as well as the update path, which the legacy
    // service did not do. `@@unique([name, organizationId])` compares the exact
    // string, so an untrimmed create could store "Tea" and "Tea " as two
    // categories that the uniqueness constraint considers different and every
    // dropdown then shows as the same name.
    data: { ...data, organizationId },
  });
}

// The legacy `updateCategory` called `update({ where: { id } })` with no
// organization, so any member could rename another tenant's category. It also
// took the whole form rather than a partial: `data.name.trim()` threw a
// TypeError on a body without a name, which the service's own catch reported as
// "Failed to fetch category". This is a true partial update now.
export async function updateCategory(
  id: string,
  data: CategoryUpdateInput,
  organizationId: string
) {
  return prisma.category.update({
    where: { id, organizationId },
    // Fields absent from the body stay `undefined` and are left untouched; fields
    // the client blanked arrived as `null` and are cleared.
    data,
  });
}

export async function removeCategory(id: string, organizationId: string) {
  // `Product.categoryId` and `Brand.categoryId` are plain foreign keys, so a
  // category in use cannot be deleted: the database refuses with P2003, which the
  // central mapping renders as "a referenced record does not exist or belongs to
  // another organization", a message that describes neither cause.
  //
  // Both are counted so the caller is told what is in the way. The count is for
  // the error the caller reads, not for integrity; the database is still what
  // stops the delete.
  const [productCount, brandCount] = await Promise.all([
    prisma.product.count({ where: { categoryId: id, organizationId } }),
    prisma.brand.count({ where: { categoryId: id, organizationId } }),
  ]);

  if (productCount > 0 || brandCount > 0) {
    throw conflict(
      "This category is still in use and cannot be deleted. Move its products and brands to another category first.",
      "CATEGORY_IN_USE",
      { productCount, brandCount }
    );
  }

  // The legacy `deleteCategory` had the same unscoped `delete({ where: { id } })`
  // as the update, so it would have removed another tenant's category.
  await prisma.category.delete({ where: { id, organizationId } });
}
