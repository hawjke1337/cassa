import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { CustomersPageClient } from "./customers-page-client"

export default async function CustomersPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("customers.view")
  if (!canView) redirect("/")

  const canManage = await checkPermission("customers.manage")

  return <CustomersPageClient canManage={canManage} />
}
