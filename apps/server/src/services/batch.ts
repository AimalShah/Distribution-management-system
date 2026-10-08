import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { BatchListQuery, StockBatchCreateInput } from "@dms/shared";
import { badRequest, notFound } from "../http/errors";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function listStockBatches(
  organizationId: string,
  query: BatchListQuery
) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const now = new Date();

  const where: Prisma.StockBatchWhereInput = {
    organizationId,
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.search
      ? {
          OR: [
            { batchNumber: { contains: query.search, mode: "insensitive" } },
            { product: { name: { contains: query.search, mode: "insensitive" } } },
            { product: { productCode: { contains: query.search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(query.expiringWithinDays !== undefined
      ? {
          expiryDate: {
            not: null,
            lte: new Date(now.getTime() + query.expiringWithinDays * MS_PER_DAY),
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.stockBatch.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            productCode: true,
            unit: true,
            unitCost: true,
            unitPrice: true,
          },
        },
      },
      orderBy: [
        { expiryDate: "asc" },
        { receivedAt: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockBatch.count({ where }),
  ]);

  const items = data.map((b) => {
    const daysUntilExpiry = b.expiryDate
      ? Math.ceil((b.expiryDate.getTime() - now.getTime()) / MS_PER_DAY)
      : null;

    const isExpired = b.expiryDate ? b.expiryDate < now : false;

    return {
      ...b,
      daysUntilExpiry,
      isExpired,
    };
  });

  return {
    data: items,
    total,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function getStockBatchById(id: string, organizationId: string) {
  const batch = await prisma.stockBatch.findFirst({
    where: { id, organizationId },
    include: {
      product: true,
      purchaseItem: {
        include: {
          purchase: {
            include: { supplier: true },
          },
        },
      },
    },
  });

  if (!batch) {
    throw notFound("Batch record not found", "BATCH_NOT_FOUND");
  }

  const now = new Date();

  const daysUntilExpiry = batch.expiryDate
    ? Math.ceil((batch.expiryDate.getTime() - now.getTime()) / MS_PER_DAY)
    : null;

  return {
    ...batch,
    daysUntilExpiry,
    isExpired: batch.expiryDate ? batch.expiryDate < now : false,
  };
}

export async function getExpiringSoonBatches(
  organizationId: string,
  days = 30,
  limit = 5
) {
  const now = new Date();
  const threshold = new Date(now.getTime() + days * MS_PER_DAY);

  const batches = await prisma.stockBatch.findMany({
    where: {
      organizationId,
      quantityRemaining: { gt: 0 },
      expiryDate: {
        not: null,
        lte: threshold,
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          productCode: true,
          unit: true,
        },
      },
    },
    orderBy: { expiryDate: "asc" },
    take: limit,
  });

  return batches.map((b) => {
    const expiryDate = b.expiryDate!;

    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / MS_PER_DAY
    );

    return {
      id: b.id,
      batchNumber: b.batchNumber,
      productId: b.productId,
      productName: b.product.name,
      productCode: b.product.productCode,
      unit: b.product.unit,
      expiryDate,
      daysUntilExpiry,
      isExpired: expiryDate < now,
      quantityRemaining: b.quantityRemaining,
    };
  });
}

export async function createStockBatch(
  organizationId: string,
  input: StockBatchCreateInput
) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, organizationId },
  });

  if (!product) {
    throw badRequest("Product does not exist in this organization", "PRODUCT_NOT_FOUND");
  }

  return prisma.stockBatch.upsert({
    where: {
      productId_batchNumber_organizationId: {
        productId: input.productId,
        batchNumber: input.batchNumber,
        organizationId,
      },
    },
    update: {
      quantityRemaining: { increment: input.quantity },
      quantityReceived: { increment: input.quantity },
      unitCost: input.unitCost ?? product.unitCost,
      expiryDate: input.expiryDate ?? undefined,
    },
    create: {
      productId: input.productId,
      organizationId,
      batchNumber: input.batchNumber,
      expiryDate: input.expiryDate ?? null,
      quantityReceived: input.quantity,
      quantityRemaining: input.quantity,
      unitCost: input.unitCost ?? product.unitCost,
    },
    include: {
      product: true,
    },
  });
}
