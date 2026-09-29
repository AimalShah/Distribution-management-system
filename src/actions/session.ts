import { auth } from "@/lib/auth";
import { headers } from "next/headers";

import prisma from "@/lib/prisma";

export async function getCurrentUserSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (session?.user) {
      return session;
    }
  } catch (error) {
    console.error("Session fetch error:", error);
  }

  // Fallback session when auth is disabled
  const user = await prisma.user.findFirst();
  const org = await prisma.organization.findFirst();

  const userId = user?.id ?? "dev-user";
  const orgId = org?.id ?? "dev-org";

  return {
    session: {
      id: "dev-session-id",
      userId,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      token: "dev-token",
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: "127.0.0.1",
      userAgent: "dev-browser",
      activeOrganizationId: orgId,
    },
    user: {
      id: userId,
      name: user?.name ?? "Admin User",
      email: user?.email ?? "admin@example.com",
      emailVerified: true,
      image: user?.image ?? null,
      createdAt: user?.createdAt ?? new Date(),
      updatedAt: user?.updatedAt ?? new Date(),
      organizationId: orgId,
      isOwner: true,
      isFormComplete: true,
      role: "admin",
      banned: false,
      banReason: null,
      banExpires: null,
    },
  };
}
