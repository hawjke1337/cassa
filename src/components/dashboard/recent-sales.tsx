"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney } from "@/lib/format"

interface RecentSale {
  id: string
  number: string
  createdAt: string
  finalAmount: number
  sellerName: string
}

interface RecentSalesProps {
  sales: RecentSale[]
}

export function RecentSales({ sales }: RecentSalesProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Последние продажи</CardTitle>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет продаж</p>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => {
              const time = new Date(sale.createdAt).toLocaleTimeString(
                "ru-RU",
                { hour: "2-digit", minute: "2-digit" }
              )
              return (
                <div
                  key={sale.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{sale.number}</span>
                      <span className="text-muted-foreground">{time}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {sale.sellerName}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">
                    {formatMoney(sale.finalAmount)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
