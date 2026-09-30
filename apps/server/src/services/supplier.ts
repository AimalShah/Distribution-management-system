import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { SupplierInput, SupplierUpdateInput } from "@dms/shared";
import { conflict } from "../http";

// The legacy list embedded every purchase a supplier had ever been billed on.
// That collection is unbounded, so the count goes on the list row and the
// purchases themselves stay on the detail route.
const listInclude = {
  _count: { select: { purchase: true } },
} satisfies Prisma.SupplierInclude;

// The legacy detail embedded every purchase the supplier had ever been billed on
// -- `purchase: true` against a `Purchase[]` relation, so the response grew with
// the supplier's entire history and never stopped. `getPurchasesBySupplier` on
// `GET /api/purchases/supplier/:supplierId` is the paginated equivalent, and the
// count on the list row already says how many there are.
const detailInclude = {} satisfies Prisma.SupplierInclude;

export type SupplierListArgs = {
  organizationId: string;
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
};

export async function getSuppliers({
  organizationId,
  page,
  pageSize,
  search,
  isActive,
}: SupplierListArgs) {
  const where: Prisma.SupplierWhereInput = {
    organizationId,
    // Absent means "both", so a list can show archived suppliers without a
    // second request.
    ...(isActive === undefined ? {} : { isActive }),
    ...(search
      ? {
          OR: [
            { companyName: { contains: search, mode: "insensitive" } },
            { supplierCode: { contains: search, mode: "insensitive" } },
            { contactPerson: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      include: listInclude,
      orderBy: { companyName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.supplier.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

// The legacy service had no single-supplier read at all — the actions file only
// exports list, create, update and delete — so the plan's detail route is new
// here rather than ported. Scoped by organization from the start: the other four
// routes were not, which is what the `updateMany`/`deleteMany` calls below are
// fixing.
export async function getSupplierById(id: string, organizationId: string) {
  return prisma.supplier.findFirst({
    where: { id, organizationId },
    include: detailInclude,
  });
}

export async function addSupplier(data: SupplierInput, organizationId: string) {
  return prisma.supplier.create({
    // The schema resolves every optional field to a value or null, so there is
    // nothing left to default here.
    data: { ...data, organizationId },
    include: detailInclude,
  });
}

// The legacy `updateSupplier` called `updateMany({ where: { id } })` and reported
// "Supplier not found or unauthorized" when the count came back 0, which is the
// only reason it looked guarded. Nothing supplied an organization, so it matched
// any tenant's row and a real cross-tenant edit reported itself as a missing
// supplier. It also returned no record, only a message.
//
// `update` is used instead so the route can answer with the updated supplier,
// and a foreign id raises P2025 for the central mapping to turn into a 404
// rather than a silent success.
export async function updateSupplier(
  id: string,
  data: SupplierUpdateInput,
  organizationId: string
) {
  return prisma.supplier.update({
    where: { id, organizationId },
    // Fields absent from the body stay `undefined` and are left untouched; fields
    // the client blanked arrived as `null` and are cleared.
    data,
    include: detailInclude,
  });
}

export async function removeSupplier(id: string, organizationId: string) {
  // `Purchase.supplierId` is a plain foreign key, so a supplier that has been
  // billed on cannot be deleted: the database refuses with P2003, which the
  // central mapping renders as "a referenced record does not exist or belongs to
  // another organization", a message that describes neither cause. The count is
  // for the error the caller reads, not for integrity — the database is still
  // what stops the delete.
  const purchaseCount = await prisma.purchase.count({
    where: { supplierId: id, organizationId },
  });

  if (purchaseCount > 0) {
    throw conflict(
      "This supplier has purchase history and cannot be deleted. Set isActive to false instead.",
      "SUPPLIER_HAS_PURCHASES",
      { purchaseCount }
    );
  }

  // The legacy `deleteSupplier` had the same unscoped `deleteMany({ where: { id } })`
  // as the update, and returned the same "not found or unauthorized" message for
  // a row it would happily have deleted from another tenant.
  await prisma.supplier.delete({ where: { id, organizationId } });
}
