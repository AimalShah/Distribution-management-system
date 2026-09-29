"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error?: Error;
  reset?: () => void;
}) {
  const pathname = usePathname();
  const [message, setMessage] = useState("Something went wrong.");

  useEffect(() => {
    if (pathname.startsWith("/dashboard")) {
      setMessage("We hit a snag while loading your dashboard.");
    } else if (pathname.startsWith("/profile")) {
      setMessage("Couldn't load your profile. Please try again.");
    } else {
      setMessage("Oops! Something went wrong.");
    }
  }, [pathname]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center text-center space-y-4 max-w-sm px-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-red-600 text-3xl">⚠️</span>
        </div>

        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {message}
        </h1>

        {process.env.NODE_ENV === "development" && error?.message && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {error.message}
          </p>
        )}

        {reset && (
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
