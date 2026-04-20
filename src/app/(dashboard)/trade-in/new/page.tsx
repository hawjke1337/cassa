import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { NewTradeInClient } from "./new-trade-in-client"

export default async function NewTradeInPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canAccept = await checkPermission("tradein.accept")
  if (!canAccept) redirect("/trade-in")

  return <NewTradeInClient />
}
