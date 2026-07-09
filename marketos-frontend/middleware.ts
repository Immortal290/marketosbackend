import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require a valid session
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/analytics",
  "/campaigns",
  "/channels",
  "/audience",
  "/contacts",
  "/canvas",
  "/creative-studio",
  "/finance",
  "/monitoring",
  "/reports",
  "/settings",
  "/competitive-intelligence",
];

// Routes only for unauthenticated users
const AUTH_ROUTES = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get("marketos_access_token")?.value;
  const isAuthenticated = !!token;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Unauthenticated user trying to access protected route → redirect to login
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user visiting login/signup → redirect to dashboard
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static files and Next.js internals
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|fonts|icons).*)",
  ],
};
