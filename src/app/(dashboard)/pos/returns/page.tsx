import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { checkPermission } from "@/lib/permissions"
import { ReturnForm } from "@/components/pos/return-form"

export default async function ReturnsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const hasPermission = await checkPermission("pos.return")
  if (!hasPermission) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Нет доступа</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            У вас нет разрешения для оформления возвратов
          </p>
        </div>
      </div>
    )
  }

  return <ReturnForm />
}
