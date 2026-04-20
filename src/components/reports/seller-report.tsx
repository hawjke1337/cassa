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
import { getSellerReport } from "@/actions/reports"

type SellerReportData = Awaited<ReturnType<typeof getSellerReport>>

interface SellerReportProps {
  storeId?: string
  dateFrom: string
  dateTo: string
}

export function SellerReport({ storeId, dateFrom, dateTo }: SellerReportProps) {
  const [data, setData] = useState<SellerReportData | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!dateFrom || !dateTo) return
    startTransition(async () => {
      try {
        const result = await getSellerReport({ storeId, dateFrom, dateTo })
        setData(result)
      } catch {
        setData(null)
      }
    })
  }, [storeId, dateFrom, dateTo])

  if (isPending || !data) {
    return <ReportSkeleton />
  }

  if (data.sellers.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Нет продаж за выбранный период
      </div>
    )
  }

  const topRevenue = data.sellers[0]?.revenue || 0

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Продавцов</div>
            <div className="mt-1 text-2xl font-bold">{data.sellers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Общая выручка</div>
            <div className="mt-1 text-2xl font-bold">
              {formatMoney(data.sellers.reduce((s, v) => s + v.revenue, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Всего продаж</div>
            <div className="mt-1 text-2xl font-bold">
              {data.sellers.reduce((s, v) => s + v.salesCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seller table */}
      <Card>
        <CardHeader>
          <CardTitle>Продавцы</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Продавец</TableHead>
                <TableHead className="text-right">Продаж</TableHead>
                <TableHead className="text-right">Выручка</TableHead>
                <TableHead className="text-right">Средний чек</TableHead>
                <TableHead className="text-right">Возвраты</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.sellers.map((s, i) => (
                <TableRow key={i} className={i === 0 ? "bg-green-500/5" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {s.name}
                      {i === 0 && (
                        <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs">
                          Лидер
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{s.salesCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden w-24 md:block">
                        <div className="h-2 rounded bg-muted">
                          <div
                            className="h-2 rounded bg-primary"
                            style={{ width: `${topRevenue > 0 ? (s.revenue / topRevenue) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      {formatMoney(s.revenue)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(s.avgCheck)}</TableCell>
                  <TableCell className="text-right">
                    {s.returnsCount > 0 ? (
                      <span className="text-orange-500">{s.returnsCount}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
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
