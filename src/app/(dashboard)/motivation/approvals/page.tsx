import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ApprovalsClient } from "./approvals-client"

export default async function ApprovalsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const permissions = session.user.permissions ?? []
  if (!permissions.includes("motivation.schemes.approve")) redirect("/motivation")

  return <ApprovalsClient />
}
