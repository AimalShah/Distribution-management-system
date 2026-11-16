import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { OrderBookerInput, OrderBookerUpdateInput } from "@dms/shared";
import { conflict, notFound } from "../http";

export type OrderBookerListArgs = {
  organizationId: string;
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
};

export async function listOrderBookers({
  organizationId,
  page,
  pageSize,
  search,
  isActive,
}: OrderBookerListArgs) {
  const where: Prisma.OrderBookerWhereInput = {
    organizationId,
  };

  if (typeof isActive === "boolean") {
    where.isActive = isActive;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.orderBooker.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.orderBooker.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

export async function getOrderBookerById(id: string, organizationId: string) {
  const booker = await prisma.orderBooker.findFirst({
    where: { id, organizationId },
  });

  if (!booker) {
    throw notFound("Order booker not found", "ORDER_BOOKER_NOT_FOUND");
  }

  return booker;
}

export async function createOrderBooker(
  data: OrderBookerInput,
  organizationId: string
) {
  const existing = await prisma.orderBooker.findFirst({
    where: { organizationId, code: data.code },
  });

  if (existing) {
    throw conflict(
      "Order booker with this code already exists",
      "ORDER_BOOKER_CODE_EXISTS"
    );
  }

  return prisma.orderBooker.create({
    data: {
      ...data,
      organizationId,
    },
  });
}

export async function updateOrderBooker(
  id: string,
  data: OrderBookerUpdateInput,
  organizationId: string
) {
  const booker = await getOrderBookerById(id, organizationId);

  if (data.code && data.code !== booker.code) {
    const existing = await prisma.orderBooker.findFirst({
      where: { organizationId, code: data.code },
    });
    if (existing && existing.id !== id) {
      throw conflict(
        "Order booker with this code already exists",
        "ORDER_BOOKER_CODE_EXISTS"
      );
    }
  }

  return prisma.orderBooker.update({
    where: { id },
    data,
  });
}
