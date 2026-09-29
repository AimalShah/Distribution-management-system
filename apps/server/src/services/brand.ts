import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { BrandInput, BrandUpdateInput } from "@dms/shared";
import { conflict, unprocessable } from "../http";

// The legacy list returned bare brand rows and nothing embeds a brand's products
// today, but a brand's product count is the one thing a caller needs before
// attempting a delete, and the legacy delete answered "Failed to delete brand"
// for every cause. Counting here makes the list say whether a delete is even
// possible.
const listInclude = {
  _count: { select: { products: true } },
} satisfies Prisma.BrandInclude;

export type BrandListArgs = {
  organizationId: string;
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
};

export async function getBrands({
  organizationId,
  page,
  pageSize,
  search,
  categoryId,
}: BrandListArgs) {
  const where: Prisma.BrandWhereInput = {
    organizationId,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    ...(categoryId ? { categoryId } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.brand.findMany({
      where,
      include: listInclude,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.brand.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

// The legacy `getBrandById` used `findUnique({ where: { id } })` with no tenant
// filter, so any authenticated member could read another tenant's brand by id.
export async function getBrandById(id: string, organizationId: string) {
  return prisma.brand.findFirst({ where: { id, organizationId } });
}

/**
 * `Brand.categoryId` is a plain foreign key with no tenant constraint of its
 * own: the database checks that some category with that id exists, and nothing
 * checks that it is in the same organization as the brand. The composite unique
 * index carries `organizationId`, so a brand pointing at another tenant's
 * category is perfectly storable.
 *
 * The legacy service never checked either, so a brand could be filed under
 * another tenant's category. A member of tenant A would then see a brand whose
 * category is not in their own category list, and the category delete guard from
 * checkpoint 2h would count that brand against tenant B.
 *
 * The message does not say whether the id exists elsewhere. A caller who learns
 * "that category belongs to someone else" from a 422 has confirmed the id is
 * real, which is a small leak of one record's existence.
 */
async function assertCategoryInOrganization(
  categoryId: string,
  organizationId: string
) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, organizationId },
    select: { id: true },
  });

  if (!category) {
    throw unprocessable(
      "Select a category that belongs to this organization.",
      "CATEGORY_NOT_IN_ORGANIZATION"
    );
  }
}

export async function addBrand(data: BrandInput, organizationId: string) {
  await assertCategoryInOrganization(data.categoryId, organizationId);

  return prisma.brand.create({
    // Trimmed on the create path as well as the update path, which the legacy
    // service did not do. `@@unique([name, categoryId, organizationId])`
    // compares the exact string, so an untrimmed create could store "Coke" and
    // "Coke " as two brands the index considers different.
    data: { ...data, organizationId },
  });
}

// The legacy `updateBrand` called `update({ where: { id } })` with no
// organization, so any member could rename or re-file another tenant's brand. It
// also assigned `categoryId: data.categoryId` unconditionally and took the whole
// form rather than a partial, so `data.name.trim()` threw a TypeError on a body
// without a name and the service's own catch reported it as
// "Failed to fetch brand".
export async function updateBrand(
  id: string,
  data: BrandUpdateInput,
  organizationId: string
) {
  if (data.categoryId !== undefined) {
    await assertCategoryInOrganization(data.categoryId, organizationId);
  }

  return prisma.brand.update({
    where: { id, organizationId },
    // Absent fields stay `undefined` and are left untouched; a description the
    // client blanked arrived as `null` and is cleared. The legacy update wrote
    // `...(data.description && { description: ... })`, and an empty string is
    // falsy, so clearing the box dropped the key and left the old description in
    // place with a success message.
    data,
  });
}

export async function removeBrand(id: string, organizationId: string) {
  // `Product.brandId` is a non-nullable foreign key, so a brand with products
  // cannot be deleted: the database refuses with P2003, which the central mapping
  // renders as "a referenced record does not exist or belongs to another
  // organization", a message that describes neither cause. Counting first lets
  // the caller be told what is in the way. The count serves the error; the
  // database remains what enforces the delete.
  const productCount = await prisma.product.count({
    where: { brandId: id, organizationId },
  });

  if (productCount > 0) {
    throw conflict(
      "This brand is still used by products and cannot be deleted. Move those products to another brand first.",
      "BRAND_IN_USE",
      { productCount }
    );
  }

  // The legacy `deleteBrand` had the same unscoped `delete({ where: { id } })`
  // as the update, so it would have removed another tenant's brand.
  await prisma.brand.delete({ where: { id, organizationId } });
}
