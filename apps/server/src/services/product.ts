import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { ProductInput, ProductUpdateInput } from "@dms/shared";

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
    ...(isActive === undefined ? {} : { isActive }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { productCode: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

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
  return prisma.product.findFirst({
    where: { id, organizationId },
    include: detailInclude,
  });
}

export async function addProduct(data: ProductInput, organizationId: string) {
  const { category, brand, ...fields } = data;

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
