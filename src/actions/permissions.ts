"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function isAdmin() {
  try {
    const { success, error } = await auth.api.hasPermission({
      body: {
        permissions: {
          project: [ "update", "delete"],
        },
      },
      headers: await headers(),
    });

    if (error) {
      return {
        success: false,
        message: error || "Faild to check permission",
      };
    }

    return {
      success: success,
    };
  } catch (e) {
    console.error(e);
    return {
      succes: false,
      message: e || "Failed to check permission",
    };
  }
}
