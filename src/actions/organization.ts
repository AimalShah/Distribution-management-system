"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getCurrentUser, getCurrentUserActiveOrganizationId } from "@/actions/user";
import {
  createOrganizationService,
  createUserForOrganizationService,
  getActiveOrganizationService,
  getUserOrganizationsService,
  getCurrentActiveOrganizationService,
  setActiveOrganizationService
} from "@/services/organization";
import { memRole } from "./members";

export async function createOrganization(name: string, slug: string) {
  try {
    const { curntUser } = await getCurrentUser();
    await createOrganizationService(curntUser.id, name, slug);
    revalidatePath("/dashboard");

    return { success: true, message: "Organization Created successfully" };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Something went wrong" };
  }
}

export async function createUserForOrganization(email: string, password: string, name: string, role: memRole) {
  try {
    const orgId = await getCurrentUserActiveOrganizationId();
    const user = await createUserForOrganizationService(orgId, email, password, name, role);
    return { success: true, message: `${user.name} created successfully` };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

export async function getActiveOrganization(userId: string) {
  return await getActiveOrganizationService(userId);
}

export async function getUserOrganization() {
  const { curntUser } = await getCurrentUser();
  const orgs = await getUserOrganizationsService(curntUser.id);
  if (orgs && orgs.length > 0) {
    return orgs;
  }
  const allOrgs = await prisma.organization.findMany();
  return allOrgs;
}

export async function getCurrentActiveOrganization() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.session?.activeOrganizationId) {
      const organization = await getCurrentActiveOrganizationService(session.session.activeOrganizationId);
      if (organization) {
        return { success: true, data: organization };
      }
    }
  } catch (error) {
    console.error(error);
  }

  // Fallback to first organization in DB
  const fallbackOrg = await prisma.organization.findFirst();
  return { success: !!fallbackOrg, data: fallbackOrg };
}

export async function setActiveOrganization(organizationId: string) {
  try {

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.session) {
      return { success: false, message: "No active organization set", data: null };
    }
    await setActiveOrganizationService(session.session.id, organizationId, session?.user.id);
    revalidatePath("/dashboard");
    return { success: true, message: "Active organization updated successfully" };
  } catch (error) {
    console.error(error);
    return { success: false, message: (error as Error).message };
  }
}
