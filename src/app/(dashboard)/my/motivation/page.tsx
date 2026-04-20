import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { MyMotivationClient } from "./my-motivation-client"

export default async function MyMotivationPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const hasAccess = await checkPermission("motivation.payroll.own")
  if (!hasAccess) redirect("/")

  return <MyMotivationClient />
}
