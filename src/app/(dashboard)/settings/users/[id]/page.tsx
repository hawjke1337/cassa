import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { getUser } from "@/actions/settings"
import { UserDetail } from "@/components/settings/user-detail"
import { InlineAuditHistory } from "@/components/settings/inline-audit-history"

interface Props {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canManage = await checkPermission("settings.users")
  if (!canManage) redirect("/settings/profile")

  const { id } = await params

  let user
  try {
    user = await getUser(id)
  } catch {
    redirect("/settings/users")
  }

  return (
    <div className="space-y-6">
      <UserDetail user={user} canManage={canManage} currentUserId={session.user.id} />
      <InlineAuditHistory entity="User" entityId={id} />
    </div>
  )
}
