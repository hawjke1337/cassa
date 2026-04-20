import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuditListClient } from "./audit-list-client"

export default async function AuditListPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canAudit = await checkPermission("inventory.audit")
  if (!canAudit) redirect("/inventory")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Инвентаризация</h1>
          <p className="text-muted-foreground">
            Проверка остатков и корректировка расхождений
          </p>
        </div>
      </div>

      <AuditListClient />
    </div>
  )
}
