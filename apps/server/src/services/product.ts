import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { ProductInput, ProductUpdateInput } from "@dms/shared";
import { notFound, unprocessable } from "../http";

/**
 * A product may only point at a category or a brand its own tenant owns.
 *
 * Checkpoint 2i added exactly this check to `addBrand`/`updateBrand`, because a
 * brand could otherwise be created against another tenant's category. The same
 * hole is one level up, and it is wider: `Product.categoryId` and
 * `Product.brandId` were written straight from the body, so a tenant could file
 * its products under another tenant's category or brand.
 *
 * Nothing downstream notices. Every read scopes the product by
 * `organizationId` and then follows the foreign key, so the foreign row's name is
 * rendered inside this tenant's product. Worse, the in-use guards on
 * `removeBrand` and `removeCategory` count *this* tenant's products before
 * refusing a delete -- so a brand that only looks in-use to someone else reads as
 * unused here, the delete is attempted, and the answer is a 400 about a foreign
 * key that describes neither cause.
 */
async function assertRefsInOrganization(
  refs: { categoryId?: string | null; brandId?: string | null },
  organizationId: string
) {
  const [category, brand] = await Promise.all([
    refs.categoryId
      ? prisma.category.findFirst({
          where: { id: refs.categoryId, organizationId },
          select: { id: true },
        })
      : null,
    refs.brandId
      ? prisma.brand.findFirst({
          where: { id: refs.brandId, organizationId },
          select: { id: true },
        })
      : null,
  ]);

  if (refs.categoryId && !category) {
    throw unprocessable(
      "Select a category that belongs to this organization.",
      "CATEGORY_NOT_IN_ORGANIZATION"
    );
  }

  if (refs.brandId && !brand) {
    throw unprocessable(
      "Select a brand that belongs to this organization.",
      "BRAND_NOT_IN_ORGANIZATION"
    );
  }
}

const listInclude = {
  category: true,
  brand: true,
  inventory: true,
} satisfies Prisma.ProductInclude;

// The legacy `getProducts` also embedded logs, purchaseItems, returnItems and
// saleItems. Those are unbounded child collections, so they stay on the detail
// route (where the legacy shape is preserved) and are left out of the list.
const detailInclude = {
  ...listInclude,
  logs: true,
  purchaseItems: true,
  returnItems: true,
  saleItems: true,
} satisfies Prisma.ProductInclude;

export type ProductListArgs = {
  organizationId: string;
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
};

export async function getProducts({
  organizationId,
  page,
  pageSize,
  search,
  isActive,
}: ProductListArgs) {
  const where: Prisma.ProductWhereInput = {
    organizationId,
  };

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { productCode: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: listInclude,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

export async function getProductById(id: string, organizationId: string) {
  const product = await prisma.product.findFirst({
    where: { id, organizationId },
    include: detailInclude,
  });

  if (!product) {
    throw notFound("Product not found", "PRODUCT_NOT_FOUND");
  }

  return product;
}

export async function addProduct(data: ProductInput, organizationId: string) {
  const { category, brand, ...fields } = data;

  await assertRefsInOrganization({ categoryId: category, brandId: brand }, organizationId);

  return prisma.product.create({
    data: {
      ...fields,
      description: fields.description ?? "",
      categoryId: category,
      brandId: brand,
      organizationId,
    },
    include: detailInclude,
  });
}

export async function updateProduct(
  id: string,
  data: ProductUpdateInput,
  organizationId: string
) {
  const { category, brand, ...fields } = data;
  const updateData: Prisma.ProductUncheckedUpdateInput = { ...fields };

  if (category !== undefined) updateData.categoryId = category;

  if (brand !== undefined) updateData.brandId = brand;

  // Only the references this update actually touches are checked. An update that
  // leaves `brand` alone must not fail because the brand already on the product
  // belongs to somebody else, and equally must not be the thing that fixes it.
  await assertRefsInOrganization(
    {
      categoryId: category === undefined ? null : category,
      brandId: brand === undefined ? null : brand,
    },
    organizationId
  );

  return prisma.product.update({
    where: { id, organizationId },
    data: updateData,
    include: detailInclude,
  });
}

// The legacy `deleteProduct(id)` took no organization, so any authenticated
// member could delete another tenant's product. Scoping the delete by
// organizationId closes that hole and turns a stale id into a 404.
export async function removeProduct(id: string, organizationId: string) {
  await prisma.product.delete({ where: { id, organizationId } });
}
