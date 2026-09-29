"use server"

import { auth } from "@/lib/auth";
import { Role } from "./user";
import { isAdmin } from "./permissions";
import prisma from "@/lib/prisma";

export type memRole = "member" | "owner" | "adminRole" | ("member" | "owner" | "adminRole")[];

export const addMember = async (
  organizationId: string,
  userId: string,
  role: memRole
) => {
  try {
    await auth.api.addMember({
      body: {
        userId,
        organizationId,
        role,
      },
    })
  } catch (error) {
    console.error("Failed to add member:", error)
    throw new Error("Failed to add member.")
  }
}

export const removeMember = async (memberId: string) => {
    const admin = await isAdmin();

    if (!admin) {
        return {
            success: false,
            error: "You are not authorized to remove members."
        }
    }

    try {
        await prisma.member.delete({
            where : {
                id : memberId
            }
        })

        return {
            success: true,
            error: null
        }
    } catch (error) {
        console.error(error);
        return {
            success: false,
            error: "Failed to remove member."
        }
    }
}

export const getUsers = async (organizationId: string) => {
  try {
    const members = await prisma.member.findMany({
      where: { organizationId },
      select: { userId: true },
    });

    const memberUserIds = members.map((m) => m.userId);

    const users = await prisma.user.findMany({
      where: {
        id: {
          notIn: memberUserIds,
        },
      },
    });

    return users;
  } catch (error) {
    console.error(error);
    return [];
  }
};