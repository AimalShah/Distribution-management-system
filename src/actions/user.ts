"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAdmin } from "./permissions";

export type Role = "user" | "admin";

export async function getCurrentUser() {
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch (e) {
    console.error("Session error:", e);
  }

  let curntUser = null;
  if (session?.user?.id) {
    curntUser = await prisma.user.findFirst({
      where: {
        id: session.user.id,
      },
    });
  }

  // Fallback when auth is disabled
  if (!curntUser) {
    curntUser = await prisma.user.findFirst();
  }

  if (!curntUser) {
    curntUser = {
      id: "dev-user",
      name: "Admin User",
      email: "admin@example.com",
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      organizationId: null,
      isOwner: true,
      isFormComplete: true,
      role: "admin",
      banned: false,
      banReason: null,
      banExpires: null,
    };
  }

  const org = await prisma.organization.findFirst();

  return {
    session: session?.session ?? {
      id: "dev-session",
      userId: curntUser.id,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      token: "dev-token",
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: "127.0.0.1",
      userAgent: "dev-browser",
      activeOrganizationId: org?.id ?? "dev-org",
    },
    user: session?.user ?? {
      ...curntUser,
      isOwner: true,
    },
    curntUser,
  };
}

export async function getCurrentUserActiveOrganizationId() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.session?.activeOrganizationId) {
      return session.session.activeOrganizationId;
    }
  } catch (e) {}

  // Fallback to first organization in DB
  const org = await prisma.organization.findFirst();
  if (org) {
    return org.id;
  }

  return "dev-org";
}

export async function createUserForOrganization(
  email: string,
  password: string,
  name: string,
  role: Role
) {
  try {
    const admin = await isAdmin();
    const { curntUser } = await getCurrentUser();

    if (!admin) {
      return {
        success: false,
        message: "Unauthorized",
      };
    }
    const newUser = await auth.api.signUpEmail({
      body: {
        name,
        password,
        email,
        isOwner: false,
        organizationId: curntUser.organizationId,
      },
    });

    const verify = await prisma.user.update({
      where: {
        id: newUser.user.id,
      },
      data: {
        emailVerified: true,
      },
    });

    if (!verify) {
      await auth.api.removeUser({
        body: {
          userId: newUser.user.id,
        },
      });

      return {
        success: false,
        message: "User Did not created please try again",
      };
    }

    return {
      success: true,
      message: "User Created Successfully",
    };
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Unknown error");
  }
}

export async function deleteUser(userId: string) {
  try {
    const user = await auth.api.removeUser({
      body: {
        userId,
      },
    });

    if (!user) {
      return {
        success: false,
        message: "Error while removing user",
      };
    }
    return {
      success: true,
      message: "User Removed",
    };
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Unknown error");
  }
}

export async function getOrganizationUser() {
  const sessionData = await auth.api.getSession({
    headers: await headers(),
  });

  if (!sessionData?.session?.activeOrganizationId) {
    throw new Error("Current session does not have an active organization.");
  }
  const users = await prisma.user.findMany({
    where: {
      organizationId: sessionData.session.activeOrganizationId,
    },
    include: {
      sessions: true,
    },
  });
  return users;
}
