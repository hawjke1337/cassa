import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { ReportsPageClient } from "./reports-page-client"

export default async function ReportsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canViewSales = await checkPermission("reports.sales")
  if (!canViewSales) redirect("/")

  const canViewProfit = await checkPermission("reports.profit")
  const canViewInventory = await checkPermission("reports.inventory")
  const canViewFunds = await checkPermission("shifts.view_all")
  const canViewSupplierDebts = await checkPermission("orders.costs")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Отчёты</h1>
          <p className="text-muted-foreground">
            Аналитика продаж, прибыли, склада и сотрудников
          </p>
        </div>
        <div className="flex gap-4">
          {canViewSupplierDebts && (
            <Link
              href="/reports/supplier-debts"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Долги поставщикам →
            </Link>
          )}
          {canViewFunds && (
            <Link
              href="/reports/funds"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Отчёт по фондам →
            </Link>
          )}
        </div>
      </div>

      <ReportsPageClient
        canViewProfit={canViewProfit}
        canViewInventory={canViewInventory}
      />
    </div>
  )
}
