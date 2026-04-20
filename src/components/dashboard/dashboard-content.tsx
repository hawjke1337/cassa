"use client"

import { useEffect, useState } from "react"
import { useCurrentStore } from "@/hooks/use-current-store"
import { getDashboardData } from "@/actions/dashboard"
import { formatMoney } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "./stat-card"
import { PendingActions } from "./pending-actions"
import { RecentSales } from "./recent-sales"
import { RecentOrders } from "./recent-orders"
import { toast } from "sonner"
import Link from "next/link"
import {
  ShoppingCart,
  DollarSign,
  Receipt,
  ClipboardList,
  Wrench,
  TrendingUp,
  CheckCircle,
  Truck,
} from "lucide-react"

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>

export function DashboardContent() {
  const { currentStoreId, currentStoreName } = useCurrentStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentStoreId) return

    setLoading(true)
    getDashboardData(currentStoreId)
      .then(setData)
      .catch(() => {
        toast.error("Ошибка загрузки данных дашборда")
      })
      .finally(() => setLoading(false))
  }, [currentStoreId])

  if (!currentStoreId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-lg text-muted-foreground">Выберите магазин для просмотра дашборда</p>
      </div>
    )
  }

  if (loading || !data) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Дашборд</h1>
        <p className="mt-1 text-muted-foreground">{currentStoreName}</p>
      </div>

      {/* Row 1: Sales overview (3 cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Продаж сегодня"
          value={String(data.sales.todayCount)}
          change={data.sales.salesCountChange}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <StatCard
          title="Выручка сегодня"
          value={formatMoney(data.sales.todayRevenue)}
          change={data.sales.revenueChange}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          title="Средний чек"
          value={formatMoney(data.sales.todayAvgCheck)}
          change={data.sales.avgCheckChange}
          icon={<Receipt className="h-4 w-4" />}
        />
      </div>

      {/* Row 2: Profit breakdown (3 cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Валовая прибыль"
          value={formatMoney(data.todayGrossProfit)}
          description={`Маржа ${data.todayGrossMargin.toFixed(1)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          valueClassName={
            data.todayGrossProfit > 0
              ? "text-blue-600"
              : data.todayGrossProfit < 0
                ? "text-red-600"
                : undefined
          }
        />
        <StatCard
          title="Чистая прибыль"
          value={formatMoney(data.todayNetProfit)}
          description="После комиссий и расходов"
          icon={<DollarSign className="h-4 w-4" />}
          valueClassName={
            data.todayNetProfit > 0
              ? "text-green-600"
              : data.todayNetProfit < 0
                ? "text-red-600"
                : undefined
          }
        />
        <StatCard
          title="Маржа"
          value={`${data.todayGrossMargin.toFixed(1)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          valueClassName={
            data.todayGrossMargin > 0
              ? "text-green-600"
              : data.todayGrossMargin < 0
                ? "text-red-600"
                : undefined
          }
        />
      </div>

      {/* Row 2: Orders + Repairs (3 cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Активных заказов"
          value={String(data.activeOrdersCount)}
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <StatCard
          title="Ремонты в работе"
          value={String(data.activeRepairsCount)}
          icon={<Wrench className="h-4 w-4" />}
        />
        <Link href="/repairs?status=READY" className="block">
          <StatCard
            title="Готовые ремонты"
            value={String(data.readyRepairsCount)}
            icon={<CheckCircle className="h-4 w-4" />}
          />
        </Link>
        {data.supplierDebtsCount > 0 && (
          <Link href="/suppliers/debts" className="block">
            <StatCard
              title="Долги поставщикам"
              value={formatMoney(data.supplierDebtsTotal)}
              description={`${data.supplierDebtsCount} неоплаченных`}
              icon={<Truck className="h-4 w-4" />}
              valueClassName="text-red-600"
            />
          </Link>
        )}
      </div>

      {/* Row 2: Pending actions + Recent sales */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PendingActions
          lowStock={data.stock.lowStock}
          outOfStock={data.stock.outOfStock}
          incomingTransfers={data.pendingActions.incomingTransfers}
          draftReceives={data.pendingActions.draftReceives}
          arrivedOrders={data.pendingActions.arrivedOrders}
        />
        <RecentSales sales={data.recentSales} />
      </div>

      {/* Row 3: Recent orders */}
      <RecentOrders orders={data.recentOrders} />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-5 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
