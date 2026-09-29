import prisma from "@/lib/prisma";
import { SupplierFormData } from "@/types/supplier";
import type { Prisma } from "../../prisma/generated";

export async function addSupplier(data: SupplierFormData, orgId: string) {
  try {
    const supplier = await prisma.supplier.create({
      data: {
        supplierCode: data.supplierCode,
        contactPerson: data.contactPerson,
        companyName: data.companyName,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        isActive: data.isActive ?? true,
        organizationId: orgId,
      },
    });

    return {
      success: true,
      message: "Supplier created successfully",
      data: supplier,
    };
  } catch (error) {
    console.error("Failed to create supplier:", error);
    return {
      success: false,
      message: "Failed to create supplier",
    };
  }
}

export async function getSuppliers(orgId: string) {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: orgId },
      include: {
        purchase: true,
      },
      orderBy: { companyName: "asc" },
    });

    return {
      success: true,
      data: suppliers,
    };
  } catch (error) {
    console.error("Failed to get suppliers:", error);
    return {
      success: false,
      message: "Failed to fetch suppliers",
      data: [],
    };
  }
}

export async function updateSupplier(
  id: string,
  data: Partial<SupplierFormData>
) {
  try {
    const updateData: Prisma.SupplierUncheckedUpdateInput = {};

    if (data.supplierCode !== undefined)
      updateData.supplierCode = data.supplierCode;
    if (data.contactPerson !== undefined)
      updateData.contactPerson = data.contactPerson;
    if (data.companyName !== undefined)
      updateData.companyName = data.companyName;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.city !== undefined) updateData.city = data.city || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.supplier.updateMany({
      where: { id },
      data: updateData,
    });

    if (updated.count === 0) {
      return {
        success: false,
        message: "Supplier not found or unauthorized",
      };
    }

    return {
      success: true,
      message: "Supplier updated successfully",
    };
  } catch (error) {
    console.error("Failed to update supplier:", error);
    return {
      success: false,
      message: "Failed to update supplier",
    };
  }
}

export async function deleteSupplier(id: string) {
  try {
    const deleted = await prisma.supplier.deleteMany({
      where: { id },
    });

    if (deleted.count === 0) {
      return {
        success: false,
        message: "Supplier not found or unauthorized",
      };
    }

    return {
      success: true,
      message: "Supplier deleted successfully",
    };
  } catch (error) {
    console.error("Failed to delete supplier:", error);
    return {
      success: false,
      message: "Failed to delete supplier",
    };
  }
}
