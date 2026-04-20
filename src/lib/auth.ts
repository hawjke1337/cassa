import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { db } from "@/lib/db"
import { authConfig } from "@/lib/auth.config"
import { getUserPermissions } from "@/lib/permissions"
import { checkRateLimit, recordFailedAttempt, clearAttempts } from "@/lib/rate-limit"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        login: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) return null

        const username = (credentials.login as string).toLowerCase()

        // AUTH-02: Rate limiting
        const rateCheck = checkRateLimit(username)
        if (!rateCheck.allowed) {
          throw new Error(
            `Слишком много попыток. Повторите через ${Math.ceil(rateCheck.retryAfterMs! / 60000)} мин.`,
          )
        }

        const user = await db.user.findUnique({
          where: { login: credentials.login as string },
        })

        if (!user || !user.isActive) {
          recordFailedAttempt(username)
          return null
        }

        const isValid = await compare(credentials.password as string, user.password)
        if (!isValid) {
          recordFailedAttempt(username)
          return null
        }

        clearAttempts(username)
        return {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          login: user.login,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        // First login: load everything
        token.id = user.id as string
        token.login = (user as any).login ?? ""

        const dbUser = await db.user.findUnique({
          where: { id: user.id! },
          select: { permissionsVersion: true },
        })

        const userRoles = await db.userRole.findMany({
          where: { userId: user.id! },
          include: { role: true },
        })
        token.roles = userRoles.map((ur) => ur.role.name)
        token.permissions = await getUserPermissions(user.id!)
        token.permissionsVersion = dbUser?.permissionsVersion ?? 1
      } else if (token.id) {
        // AUTH-01: Subsequent requests — check if permissions changed
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { permissionsVersion: true, isActive: true },
        })

        // If user was deactivated, invalidate token
        if (!dbUser || !dbUser.isActive) {
          token.permissions = []
          token.roles = []
          return token
        }

        if (dbUser.permissionsVersion !== token.permissionsVersion) {
          const userRoles = await db.userRole.findMany({
            where: { userId: token.id as string },
            include: { role: true },
          })
          token.roles = userRoles.map((ur) => ur.role.name)
          token.permissions = await getUserPermissions(token.id as string)
          token.permissionsVersion = dbUser.permissionsVersion
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.login = token.login as string
        session.user.roles = token.roles as string[]
        session.user.permissions = token.permissions as string[]
      }
      return session
    },
  },
})
