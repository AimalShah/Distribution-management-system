import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { CustomerInput, CustomerUpdateInput } from "@dms/shared";
import { conflict } from "../http";

// The legacy `getCustomers` embedded every sale a customer had in each list row.
// That collection is unbounded, so it becomes a count here and the history
// itself stays on `GET /api/sales/customer/:customerId`, which is paginated.
const customerInclude = {
  _count: { select: { sale: true } },
} satisfies Prisma.CustomerInclude;

export type CustomerListArgs = {
  organizationId: string;
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
};

export async function getCustomers({
  organizationId,
  page,
  pageSize,
  search,
  isActive,
}: CustomerListArgs) {
  const where: Prisma.CustomerWhereInput = {
    organizationId,
    // Absent means "both", so a list can show archived customers without a
    // second request.
    ...(isActive === undefined ? {} : { isActive }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { customerCode: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: customerInclude,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

// The legacy `getCustomerById` used `findUnique({ where: { id } })`, so any
// authenticated member could read another tenant's customer by id. Scoped here.
export async function getCustomerById(id: string, organizationId: string) {
  return prisma.customer.findFirst({
    where: { id, organizationId },
    include: customerInclude,
  });
}

export async function addCustomer(data: CustomerInput, organizationId: string) {
  return prisma.customer.create({
    // The schema already resolved every optional field to a value or null, so
    // there is nothing left to default here.
    data: { ...data, organizationId },
    include: customerInclude,
  });
}

// The legacy `updateCustomer` called `update({ where: { id } })` with no
// organization, so any member could rewrite another tenant's customer. It also
// copied `creditLimit` straight through without the `Number()` the create path
// used, storing the raw string into a `Float` column.
export async function updateCustomer(
  id: string,
  data: CustomerUpdateInput,
  organizationId: string
) {
  return prisma.customer.update({
    where: { id, organizationId },
    // Fields absent from the body stay `undefined` and are left untouched; fields
    // the client blanked arrived as `null` and are cleared.
    data,
    include: customerInclude,
  });
}

export async function removeCustomer(id: string, organizationId: string) {
  // The legacy `deleteCustomer` also took no organization, so any member could
  // delete another tenant's customer.
  //
  // `Sale.customerId` is a plain foreign key, so a customer with sales history
  // cannot be deleted at all: the database rejects the row with `P2003`, which
  // the central mapping renders as "a referenced record does not exist or
  // belongs to another organization" — a message that describes neither cause.
  //
  // This check is for the error the caller reads, not for integrity: the
  // database is still what stops the delete, so a sale created between the count
  // and the delete falls back to that worse message. Wrapping both in a
  // transaction would close the window at the cost of holding one open for a
  // precondition, which is not worth it here.
  const saleCount = await prisma.sale.count({
    where: { customerId: id, organizationId },
  });

  if (saleCount > 0) {
    throw conflict(
      "This customer has sales history and cannot be deleted. Set isActive to false instead.",
      "CUSTOMER_HAS_SALES",
      { saleCount }
    );
  }

  await prisma.customer.delete({ where: { id, organizationId } });
}
