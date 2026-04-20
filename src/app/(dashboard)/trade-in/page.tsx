import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { TradeInPageClient } from "./trade-in-page-client"

export default async function TradeInPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("tradein.view")
  if (!canView) redirect("/")

  const canAccept = await checkPermission("tradein.accept")

  return <TradeInPageClient canAccept={canAccept} />
}
