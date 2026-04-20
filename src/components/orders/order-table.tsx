"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getOrders } from "@/actions/orders"
import { formatMoney, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, Loader2 } from "lucide-react"
import { STATUS_LABELS, STATUS_COLORS } from "./order-status"
import type { CustomOrderStatus } from "@/generated/prisma/client"

interface OrderTableProps {
  storeId: string
}

type OrderRow = Awaited<ReturnType<typeof getOrders>>["orders"][number]

const STATUS_TABS = [
  { value: "ALL", label: "Все" },
  { value: "NEW", label: "Новые" },
  { value: "ACTIVE", label: "В работе" },
  { value: "READY", label: "Готовы" },
  { value: "DONE", label: "Завершённые" },
]

export function OrderTable({ storeId }: OrderTableProps) {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [page, setPage] = useState(1)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getOrders(storeId, {
        search: search || undefined,
        status: statusFilter,
        page,
        perPage: 25,
      })
      setOrders(result.orders)
      setTotal(result.total)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [storeId, search, statusFilter, page])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени, телефону, номеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          {search || statusFilter !== "ALL"
            ? "Заказы не найдены"
            : "Нет заказов"}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>№</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead className="hidden md:table-cell">Товары</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-right">Оплачено</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="hidden sm:table-cell">Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <TableCell className="font-mono text-xs">
                    {order.number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.clientName}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.clientPhone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-[200px] truncate md:table-cell">
                    <span className="text-muted-foreground text-xs">
                      {order.itemsSummary}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(order.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(order.prepaidAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        STATUS_COLORS[order.status as CustomOrderStatus]
                      }
                    >
                      {STATUS_LABELS[order.status as CustomOrderStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {formatDate(order.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {total > 25 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Показано {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} из{" "}
                {total}
              </span>
              <div className="flex gap-2">
                <button
                  className="rounded px-2 py-1 hover:bg-muted disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Назад
                </button>
                <button
                  className="rounded px-2 py-1 hover:bg-muted disabled:opacity-50"
                  disabled={page * 25 >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Вперёд
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
