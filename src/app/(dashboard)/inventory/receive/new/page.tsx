import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NewReceiveClient } from "./new-receive-client"

export default async function NewReceivePage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canReceive = await checkPermission("inventory.receive")
  if (!canReceive) redirect("/inventory")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory/receive">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Новый приход</h1>
          <p className="text-muted-foreground">
            Оформление прихода товара на склад
          </p>
        </div>
      </div>

      <NewReceiveClient />
    </div>
  )
}
