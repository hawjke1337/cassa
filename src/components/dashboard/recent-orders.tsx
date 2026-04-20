"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatMoney } from "@/lib/format"
import {
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/components/orders/order-status"
import type { CustomOrderStatus } from "@/generated/prisma/client"

interface RecentOrder {
  id: string
  number: string
  clientName: string
  status: string
  totalAmount: number
  createdAt: string
}

interface RecentOrdersProps {
  orders: RecentOrder[]
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Последние заказы</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет заказов</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const status = order.status as CustomOrderStatus
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{order.number}</span>
                      <Badge
                        className={STATUS_COLORS[status]}
                        variant="outline"
                      >
                        {STATUS_LABELS[status]}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.clientName}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">
                    {formatMoney(order.totalAmount)}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
