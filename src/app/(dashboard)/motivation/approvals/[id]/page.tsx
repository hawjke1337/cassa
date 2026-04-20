import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ApprovalDetailClient } from "./approval-detail-client"

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const permissions = session.user.permissions ?? []
  if (!permissions.includes("motivation.schemes.approve")) redirect("/motivation")

  const { id } = await params

  return <ApprovalDetailClient schemeId={id} />
}
