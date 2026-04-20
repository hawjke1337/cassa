import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { FeesPageClient } from "./fees-page-client"

export default async function FeesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canManage = await checkPermission("settings.stores")
  if (!canManage) redirect("/settings/profile")

  return <FeesPageClient />
}
