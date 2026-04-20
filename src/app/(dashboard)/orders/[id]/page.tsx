import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { OrderDetail } from "@/components/orders/order-detail"

interface OrderDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canView = await checkPermission("orders.view")
  if (!canView) redirect("/")

  const canManage = await checkPermission("orders.manage")
  const canSeeCosts = await checkPermission("orders.costs")

  return (
    <OrderDetail
      orderId={id}
      canManage={canManage}
      canSeeCosts={canSeeCosts}
    />
  )
}
