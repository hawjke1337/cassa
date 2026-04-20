import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { RepairDetail } from "@/components/repairs/repair-detail"

interface RepairDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function RepairDetailPage({ params }: RepairDetailPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("repairs.view")
  if (!canView) redirect("/")

  const canManage = await checkPermission("repairs.manage")
  const canWarranty = await checkPermission("repairs.warranty")

  return (
    <RepairDetail
      repairId={id}
      canManage={canManage}
      canWarranty={canWarranty}
    />
  )
}
