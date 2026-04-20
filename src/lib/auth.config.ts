import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  session: { strategy: "jwt", maxAge: 900 }, // 15 minutes
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.login = (user as any).login ?? ""
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.login = token.login as string
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnLogin = nextUrl.pathname.startsWith("/login")
      const isAuthApi = nextUrl.pathname.startsWith("/api/auth")

      if (isAuthApi) return true

      if (!isLoggedIn && !isOnLogin) {
        return Response.redirect(new URL("/login", nextUrl))
      }

      if (isLoggedIn && isOnLogin) {
        return Response.redirect(new URL("/", nextUrl))
      }

      return true
    },
  },
} satisfies NextAuthConfig
