"use client"

import { useEffect, useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatMoney } from "@/lib/format"
import { getInventoryReport } from "@/actions/reports"

type InventoryReportData = Awaited<ReturnType<typeof getInventoryReport>>

interface InventoryReportProps {
  storeId: string
}

export function InventoryReport({ storeId }: InventoryReportProps) {
  const [data, setData] = useState<InventoryReportData | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!storeId) return
    startTransition(async () => {
      try {
        const result = await getInventoryReport({ storeId })
        setData(result)
      } catch {
        setData(null)
      }
    })
  }, [storeId])

  if (isPending || !data) {
    return <ReportSkeleton />
  }

  const maxCategoryValue = Math.max(...data.topCategories.map((c) => c.costValue), 1)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard title="Товаров на складе" value={String(data.totalItems)} />
        <SummaryCard title="Стоимость (продажная)" value={formatMoney(data.totalSellValue)} />
        <SummaryCard title="Стоимость (закупочная)" value={formatMoney(data.totalCostValue)} />
        <SummaryCard
          title="Потенциальная прибыль"
          value={formatMoney(data.totalSellValue - data.totalCostValue)}
          color="text-green-500"
        />
      </div>

      {/* Alerts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Мало на складе</span>
              <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                {data.lowStockCount}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Нет в наличии</span>
              <Badge variant="outline" className="text-red-500 border-red-500/30">
                {data.outOfStockCount}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top categories by value */}
      {data.topCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Категории по стоимости запасов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topCategories.map((c) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-sm">{c.name}</span>
                  <div className="flex-1 rounded bg-muted">
                    <div
                      className="h-6 rounded bg-emerald-500 transition-all"
                      style={{ width: `${(c.costValue / maxCategoryValue) * 100}%` }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right text-sm">{formatMoney(c.costValue)}</span>
                  <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{c.count} шт</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low stock table */}
      {data.lowStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Мало на складе</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead className="text-right">Остаток</TableHead>
                  <TableHead className="text-right">Минимум</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lowStock.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.sku}</div>
                    </TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right text-orange-500 font-medium">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right">{item.minQty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Out of stock table */}
      {data.outOfStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Нет в наличии</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead>Категория</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.outOfStock.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.sku}</div>
                    </TableCell>
                    <TableCell>{item.category}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({
  title,
  value,
  color,
}: {
  title: string
  value: string
  color?: string
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className={`mt-1 text-2xl font-bold ${color || ""}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="mb-2 h-4 w-20" />
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-4">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
