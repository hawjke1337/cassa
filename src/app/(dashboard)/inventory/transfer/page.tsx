import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransferPageClient } from "./transfer-page-client"

export default async function TransferPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canTransfer = await checkPermission("inventory.transfer")
  if (!canTransfer) redirect("/inventory")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Перемещение товаров</h1>
          <p className="text-muted-foreground">
            Перемещение между магазинами
          </p>
        </div>
      </div>

      <TransferPageClient />
    </div>
  )
}
