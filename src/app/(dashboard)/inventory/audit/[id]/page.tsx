import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuditDetailClient } from "./audit-detail-client"

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canAudit = await checkPermission("inventory.audit")
  if (!canAudit) redirect("/inventory")

  const { id } = await params

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory/audit">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Инвентаризация</h1>
        </div>
      </div>

      <AuditDetailClient auditId={id} />
    </div>
  )
}
