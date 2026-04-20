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
import { formatMoney } from "@/lib/format"
import { getSalesReport } from "@/actions/reports"

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  SBP: "СБП",
  TRANSFER: "Перевод",
  CREDIT: "Кредит",
}

type SalesReportData = Awaited<ReturnType<typeof getSalesReport>>

interface SalesReportProps {
  storeId?: string
  dateFrom: string
  dateTo: string
  groupBy: "day" | "month"
}

export function SalesReport({ storeId, dateFrom, dateTo, groupBy }: SalesReportProps) {
  const [data, setData] = useState<SalesReportData | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!dateFrom || !dateTo) return
    startTransition(async () => {
      try {
        const result = await getSalesReport({ storeId, dateFrom, dateTo, groupBy })
        setData(result)
      } catch {
        setData(null)
      }
    })
  }, [storeId, dateFrom, dateTo, groupBy])

  if (isPending || !data) {
    return <ReportSkeleton />
  }

  const maxChartRevenue = Math.max(...data.chartData.map((d) => d.revenue), 1)
  const maxPayment = Math.max(...data.paymentData.map((d) => d.amount), 1)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard title="Продаж" value={String(data.salesCount)} />
        <SummaryCard title="Выручка" value={formatMoney(data.netRevenue)} />
        <SummaryCard title="Скидки" value={formatMoney(data.totalDiscount)} />
        <SummaryCard title="Средний чек" value={formatMoney(data.avgCheck)} />
      </div>

      {/* Sales chart */}
      {data.chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Динамика продаж</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.chartData.map((d) => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-sm text-muted-foreground">{d.label}</span>
                  <div className="flex-1 rounded bg-muted">
                    <div
                      className="h-6 rounded bg-primary transition-all"
                      style={{ width: `${(d.revenue / maxChartRevenue) * 100}%` }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right text-sm">{formatMoney(d.revenue)}</span>
                  <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">{d.count} шт</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment methods */}
      {data.paymentData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Способы оплаты</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.paymentData
                .sort((a, b) => b.amount - a.amount)
                .map((d) => (
                  <div key={d.method} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-sm">{PAYMENT_LABELS[d.method] || d.method}</span>
                    <div className="flex-1 rounded bg-muted">
                      <div
                        className="h-6 rounded bg-blue-500 transition-all"
                        style={{ width: `${(d.amount / maxPayment) * 100}%` }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right text-sm">{formatMoney(d.amount)}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top products */}
      <div className="grid gap-4 md:grid-cols-2">
        {data.topByQty.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Топ по количеству</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="text-right">Кол-во</TableHead>
                    <TableHead className="text-right">Выручка</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topByQty.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.sku}</div>
                      </TableCell>
                      <TableCell className="text-right">{p.quantity}</TableCell>
                      <TableCell className="text-right">{formatMoney(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {data.topByRevenue.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Топ по выручке</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="text-right">Выручка</TableHead>
                    <TableHead className="text-right">Кол-во</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topByRevenue.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.sku}</div>
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(p.revenue)}</TableCell>
                      <TableCell className="text-right">{p.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {data.salesCount === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          Нет продаж за выбранный период
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
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
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
