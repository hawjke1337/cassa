"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertTriangle,
  PackageX,
  Truck,
  FileText,
  PackageCheck,
} from "lucide-react"

interface PendingActionsProps {
  lowStock: number
  outOfStock: number
  incomingTransfers: number
  draftReceives: number
  arrivedOrders: number
}

export function PendingActions({
  lowStock,
  outOfStock,
  incomingTransfers,
  draftReceives,
  arrivedOrders,
}: PendingActionsProps) {
  const items = [
    {
      count: lowStock,
      label: "товаров с низким остатком",
      href: "/inventory",
      icon: AlertTriangle,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
    },
    {
      count: outOfStock,
      label: "товаров нет в наличии",
      href: "/inventory",
      icon: PackageX,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      count: incomingTransfers,
      label: "перемещений ожидают приёмки",
      href: "/inventory/transfer",
      icon: Truck,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
    {
      count: draftReceives,
      label: "черновиков прихода",
      href: "/inventory/receive",
      icon: FileText,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      count: arrivedOrders,
      label: "заказов прибыли",
      href: "/orders",
      icon: PackageCheck,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
  ].filter((item) => item.count > 0)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Требуют внимания</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Нет активных уведомлений
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <span className="text-sm">
                    <span className="font-semibold">{item.count}</span>{" "}
                    {item.label}
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
