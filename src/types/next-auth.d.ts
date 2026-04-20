import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    login?: string
  }

  interface Session {
    user: {
      id: string
      name: string
      login: string
      roles: string[]
      permissions: string[]
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    login: string
    roles: string[]
    permissions: string[]
  }
}
