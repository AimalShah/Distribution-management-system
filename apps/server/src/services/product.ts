import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import { buildSku, codeFor, type ProductInput, type ProductUpdateInput } from "@dms/shared";
import { conflict, notFound, unprocessable } from "../http";
import { getCompanySettings } from "./settings";

/** Just enough of a brand/category to resolve a SKU token. */
type SkuRef = { id: string; name: string; shortCode: string | null };

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
): Promise<{ category: SkuRef | null; brand: SkuRef | null }> {
  const [category, brand] = await Promise.all([
    refs.categoryId
      ? prisma.category.findFirst({
          where: { id: refs.categoryId, organizationId },
          select: { id: true, name: true, shortCode: true },
        })
      : null,
    refs.brandId
      ? prisma.brand.findFirst({
          where: { id: refs.brandId, organizationId },
          select: { id: true, name: true, shortCode: true },
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

  return { category: category ?? null, brand: brand ?? null };
}

/**
 * The next value of the Company's SKU sequence. It only ever moves forward
 * (ADR 0007): the row is created if missing and then incremented in one
 * statement, so a deleted product never frees its number for reuse.
 */
async function nextSkuSequence(organizationId: string): Promise<number> {
  await prisma.companySettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });

  const updated = await prisma.companySettings.update({
    where: { organizationId },
    data: { skuSequence: { increment: 1 } },
  });

  return updated.skuSequence;
}

/**
 * Build a unique SKU from the Company's format. Each attempt takes the next
 * sequence value, so two products never share a code; the pre-check makes a
 * collision retry rather than surfacing a raw unique-constraint error, and the
 * `productCode` unique index remains the actual enforcement.
 */
async function generateProductCode(
  organizationId: string,
  refs: { category: SkuRef | null; brand: SkuRef | null },
  name: string
): Promise<string> {
  const settings = await getCompanySettings(organizationId);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sequence = await nextSkuSequence(organizationId);

    const candidate = buildSku(settings.skuFormat, settings.skuSeparator, {
      brand: codeFor(refs.brand?.shortCode, refs.brand?.name),
      category: codeFor(refs.category?.shortCode, refs.category?.name),
      name,
      sequence,
      date: new Date(),
    });

    const existing = await prisma.product.findFirst({
      where: { productCode: candidate },
      select: { id: true },
    });

    if (!existing) return candidate;
  }

  throw conflict(
    "Could not generate a unique SKU. Adjust the SKU format in Company settings.",
    "SKU_GENERATION_FAILED"
  );
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
  brandId?: string;
};

export async function getProducts({
  organizationId,
  page,
  pageSize,
  search,
  isActive,
  brandId,
}: ProductListArgs) {
  const where: Prisma.ProductWhereInput = {
    organizationId,
  };

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (brandId) {
    where.brandId = brandId;
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
  const { category, brand, productCode, ...fields } = data;

  const refs = await assertRefsInOrganization(
    { categoryId: category, brandId: brand },
    organizationId
  );

  // A caller that still supplies a code has it honoured (imports and legacy
  // clients); otherwise the SKU is generated from the Company's format, and the
  // `@unique` index is what actually enforces uniqueness either way.
  const code = productCode ?? (await generateProductCode(organizationId, refs, fields.name));

  return prisma.product.create({
    data: {
      ...fields,
      productCode: code,
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
