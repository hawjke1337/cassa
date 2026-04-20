import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { WarrantyDetailClient } from "@/components/warranty/warranty-detail-client"

export default async function WarrantyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("warranty.view")
  if (!canView) redirect("/")

  const canManage = await checkPermission("warranty.manage")

  return <WarrantyDetailClient id={id} canManage={canManage} />
}
