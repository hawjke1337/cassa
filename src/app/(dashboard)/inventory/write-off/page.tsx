import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WriteOffPageClient } from "./write-off-page-client"

export default async function WriteOffPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canWriteOff = await checkPermission("inventory.writeoff")
  if (!canWriteOff) redirect("/inventory")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Списание товаров</h1>
          <p className="text-muted-foreground">
            Списание товаров с уменьшением остатков
          </p>
        </div>
      </div>

      <WriteOffPageClient />
    </div>
  )
}
