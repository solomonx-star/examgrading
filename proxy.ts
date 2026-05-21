import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/models/User";

const ROLE_HOME: Record<UserRole, string> = {
  superadmin: "/superadmin",
  admin: "/admin",
  lecturer: "/lecturer",
  student: "/student",
};

const ROLE_PREFIXES: Record<UserRole, string[]> = {
  superadmin: ["/superadmin"],
  admin: ["/admin"],
  lecturer: ["/lecturer"],
  student: ["/student"],
};

const PUBLIC_PATHS = ["/login", "/change-password"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function matchesRolePrefix(role: UserRole, pathname: string): boolean {
  return ROLE_PREFIXES[role].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isRoleScopedPath(pathname: string): boolean {
  return (Object.keys(ROLE_PREFIXES) as UserRole[]).some((role) =>
    matchesRolePrefix(role, pathname),
  );
}

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const session = req.auth;
  const user = session?.user;

  if (!user) {
    if (isPublic(pathname)) return NextResponse.next();
    if (pathname === "/") return NextResponse.next();

    const loginUrl = new URL("/login", nextUrl);
    if (pathname !== "/login") {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  const home = ROLE_HOME[user.role];

  if (user.mustChangePassword && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", nextUrl));
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL(home, nextUrl));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(home, nextUrl));
  }

  if (isRoleScopedPath(pathname) && !matchesRolePrefix(user.role, pathname)) {
    return NextResponse.redirect(new URL(home, nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except API routes, static assets, and image optimizer.
  // API routes do their own auth check via lib/session.ts.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
