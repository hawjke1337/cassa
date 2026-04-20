import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { SupplierDetail } from "@/components/suppliers/supplier-detail"

interface SupplierDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("suppliers.view")
  if (!canView) redirect("/")

  const canEdit = await checkPermission("suppliers.edit")

  return <SupplierDetail supplierId={id} canEdit={canEdit} />
}
