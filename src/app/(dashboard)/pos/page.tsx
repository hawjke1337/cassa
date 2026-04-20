import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { checkPermission } from "@/lib/permissions"
import { PosInterface } from "@/components/pos/pos-interface"
import Link from "next/link"

export default async function PosPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const hasPermission = await checkPermission("pos.sell")
  if (!hasPermission) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Нет доступа</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            У вас нет разрешения для работы с кассой
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Касса</h1>
        <Link
          href="/pos/returns"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Возвраты
        </Link>
      </div>
      <PosInterface />
    </div>
  )
}
