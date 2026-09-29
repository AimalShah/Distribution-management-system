import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { addMember, memRole } from "@/actions/members";

export async function createOrganizationService(userId: string, name: string, slug: string) {
  const data = await auth.api.createOrganization({
    body: { name, slug, userId },
    headers: await headers(),
  });

  if (!data) throw new Error("Error creating organization");

  await prisma.user.update({
    where: { id: userId },
    data: { organizationId: data.id, isFormComplete: true },
  });

  return data;
}

export async function createUserForOrganizationService(
  orgId: string,
  email: string,
  password: string,
  name: string,
  role: memRole
) {
  const res = await auth.api.signUpEmail({
    body: {
      name,
      email,
      password,
      isOwner: false,
      organizationId: orgId,
    },
  });

  await prisma.user.update({
    where: { id: res.user.id },
    data: {
      role: typeof role === "string" ? role : role[0],
      emailVerified: true,
    },
  });

  await addMember(orgId, res.user.id, role);

  return res.user;
}

export async function getActiveOrganizationService(userId: string) {
  const memberUser = await prisma.member.findFirst({ where: { userId } });
  if (!memberUser) return null;

  return await prisma.organization.findFirst({
    where: { id: memberUser.organizationId },
  });
}

export async function getUserOrganizationsService(userId: string) {
  return await prisma.organization.findMany({
    where: {
      members: { some: { userId } },
    },
    include: { members: true },
  });
}

export async function getCurrentActiveOrganizationService(activeOrgId: string) {
  return await prisma.organization.findUnique({ where: { id: activeOrgId } });
}

export async function setActiveOrganizationService(sessionId: string, orgId: string, userId: string) {
  const membership = await prisma.member.findFirst({
    where: { userId, organizationId: orgId },
  });

  if (!membership) throw new Error("You are not a member of this organization");

  await prisma.session.update({
    where: { id: sessionId },
    data: { activeOrganizationId: orgId },
  });
}
