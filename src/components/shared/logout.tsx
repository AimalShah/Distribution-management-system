"use client";

import { signOut } from "@/lib/auth-client";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function Logout() {
  const router = useRouter();
  return (
    <Button
      type="submit"
      onClick={() =>
        signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/");
            },
          },
        })
      }
    >
      <LogOut className="h-4 w-4" />
      Logout
    </Button>
  );
}
