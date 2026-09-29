"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Loading() {
  const pathname = usePathname();
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    if (pathname.startsWith("/dashboard")) {
      setMessage("Loading your dashboard...");
    } else if (pathname.startsWith("/profile")) {
      setMessage("Fetching your profile...");
    } else {
      setMessage("Getting things ready...");
    }
  }, [pathname]);

  return (
    <div className="flex items-center justify-center h-screen bg-white/20 dark:bg-gray-900/70 backdrop-blur-md">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>

        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          {message}
        </p>
      </div>
    </div>
  );
}
