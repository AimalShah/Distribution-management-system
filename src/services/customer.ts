import prisma from "@/lib/prisma";
import { CustomerFormData } from "@/types/customer";

export async function addCustomer(data: CustomerFormData, orgId: string) {
  try {
    const newCustomer = await prisma.customer.create({
      data: {
        customerCode: data.customerCode,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        organizationId: orgId,
        creditLimit: data.creditLimit ? Number(data.creditLimit) : null,
        isActive: data.isActive ?? true,
      },
    });
    return {
      success: true,
      message: "Customer added successfully",
      data: newCustomer,
    };
  } catch (error) {
    console.error("Failed to add customer:", error);
    return { success: false, message: "Failed to add customer" };
  }
}

export async function getCustomers(orgId: string) {
  try {
    const customers = await prisma.customer.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        sale: true,
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: customers,
    };
  } catch (error) {
    console.error("Failed to get customers:", error);
    return {
      success: false,
      message: "Failed to fetch customers",
    };
  }
}

export async function getCustomerById(id: string) {
  try {
    const customer = await prisma.customer.findUnique({
      where: {
        id,
      },
      include: {
        sale: true,
      },
    });

    return {
      success: true,
      data: customer,
    };
  } catch (error) {
    console.error("Failed to get customer:", error);
    return {
      success: false,
      message: "Failed to fetch customer",
    };
  }
}

export async function updateCustomer(
  id: string,
  data: Partial<CustomerFormData>
) {
  try {
    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.customerCode !== undefined && {
          customerCode: data.customerCode,
        }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.creditLimit !== undefined && {
          creditLimit: data.creditLimit,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
    return {
      success: true,
      message: "category updated successfully",
      data: updatedCustomer,
    };
  } catch (error) {
    console.error("Failed to fetch category:", error);
    return { success: false, message: "Failed to fetch category" };
  }
}

export async function deleteCustomer(id: string) {
  try {
    await prisma.customer.delete({ where: { id } });
    return { success: true, message: "Customer deleted successfully" };
  } catch (error) {
    console.error("Failed to delete customer:", error);
    return { success: false, message: "Failed to delete customer" };
  }
}
