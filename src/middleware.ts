import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const tenant = request.cookies.get("tenant_slug")?.value;

  // If URL already has tenant → rewrite to real route
  if (tenant && pathname.startsWith(`/${tenant}`)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(`/${tenant}`, "");
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};