import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PayrollsClient } from "./payrolls-client"

export default async function PayrollsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const permissions = session.user.permissions ?? []
  if (!permissions.includes("motivation.payroll.view")) redirect("/motivation")

  return <PayrollsClient />
}
