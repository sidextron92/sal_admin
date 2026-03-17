import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.cookies.get("sal_session");

  // Redirect root to dashboard
  if (pathname === "/") {
    if (session?.value === "authenticated") {
      return NextResponse.redirect(new URL("/dashboard/overview", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protect /dashboard routes
  if (pathname.startsWith("/dashboard")) {
    if (!session || session.value !== "authenticated") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
