import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  console.log(`[PROXY] ${request.method} ${pathname}`)

  // Allow auth API routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next()
  }

  // Check for session cookie (lightweight — no JWT decode)
  const sessionCookie =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token")

  const isOnLogin = pathname.startsWith("/login")

  if (!sessionCookie && !isOnLogin) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (sessionCookie && isOnLogin) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
