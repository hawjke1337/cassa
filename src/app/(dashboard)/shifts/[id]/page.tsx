import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { ShiftDetailClient } from "./shift-detail-client"

interface ShiftDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ShiftDetailPage({ params }: ShiftDetailPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("shifts.view")
  const canViewAll = await checkPermission("shifts.view_all")
  if (!canView && !canViewAll) redirect("/")

  return <ShiftDetailClient shiftId={id} />
}
