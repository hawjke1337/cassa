import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { PriceLabelsClient } from "./price-labels-client"

export default async function PriceLabelsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canManage = await checkPermission("settings.templates")
  if (!canManage) redirect("/settings/profile")

  return <PriceLabelsClient />
}
