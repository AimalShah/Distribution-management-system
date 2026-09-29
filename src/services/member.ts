import { auth } from "@/lib/auth";
import { isAdmin } from "./permissions";
import prisma from "@/lib/prisma";
import type { memRole } from "@/actions/members";

export async function addMember(
  organizationId: string,
  userId: string,
  role: memRole,
) {
  try {
    await auth.api.addMember({
      body: {
        userId,
        organizationId,
        role: role,
      },
    });

    return {
      success: true,
      message: "Member Added successfully",
    };
  } catch (e) {
    console.error(e);
    throw new Error("Something went wrong while adding member");
  }
}

export async function removeMember(memberId: string) {
  const admin = await isAdmin();

  if (!isAdmin) {
    return {
      success: false,
      message: "You are not authorized to remove members",
    };
  }

  try {
    await prisma.member.delete({
      where: {
        id: memberId,
      },
    });

    return {
      success: true,
      message: "Member remove  successfully",
    };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      message: e instanceof Error ? e.message : "Faild to remove Member",
    };
  }
}
