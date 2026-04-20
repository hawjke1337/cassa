import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { Plus, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReceiveListClient } from "./receive-list-client"

export default async function ReceiveListPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canReceive = await checkPermission("inventory.receive")
  if (!canReceive) redirect("/inventory")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Приход товара</h1>
            <p className="text-muted-foreground">
              Документы прихода товара на склад
            </p>
          </div>
        </div>
        <Link href="/inventory/receive/new">
          <Button size="sm">
            <Plus className="size-4" />
            Новый приход
          </Button>
        </Link>
      </div>

      <ReceiveListClient />
    </div>
  )
}
