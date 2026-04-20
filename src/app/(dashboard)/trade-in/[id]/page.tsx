import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { TradeInDetailClient } from "./trade-in-detail-client"

interface TradeInDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TradeInDetailPage({ params }: TradeInDetailPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("tradein.view")
  if (!canView) redirect("/")

  const canManage = await checkPermission("tradein.manage")
  const canDelete = await checkPermission("tradein.delete")

  return <TradeInDetailClient tradeInId={id} canManage={canManage} canDelete={canDelete} />
}
