import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  // Auth check temporarily disabled
  // const sessionCookie = getSessionCookie(request);
  // if (!sessionCookie) {
  //   return NextResponse.redirect(new URL("/", request.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/c/[company]",
    "/customer",
    "/inventory",
    "/product",
    "/purchase/:path*",
    "/reports",
    "/returns/:path*",
    "/returns/:path*",
    "/sale-invoice/:path*",
    "/supplier/:path*",
    "/users",
    "/profile",
    "/register",
  ],
};
