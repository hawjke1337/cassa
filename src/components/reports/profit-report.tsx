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
import { getProfitReport } from "@/actions/reports"

type ProfitReportData = Awaited<ReturnType<typeof getProfitReport>>

interface ProfitReportProps {
  storeId?: string
  dateFrom: string
  dateTo: string
}

export function ProfitReport({ storeId, dateFrom, dateTo }: ProfitReportProps) {
  const [data, setData] = useState<ProfitReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!dateFrom || !dateTo) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await getProfitReport({ storeId, dateFrom, dateTo })
        setData(result)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки")
        setData(null)
      }
    })
  }, [storeId, dateFrom, dateTo])

  if (error) {
    return <div className="py-12 text-center text-destructive">{error}</div>
  }

  if (isPending || !data) {
    return <ReportSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Revenue, returns, COGS, gross profit, margin */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <SummaryCard title="Выручка" value={formatMoney(data.revenue)} />
        <SummaryCard
          title="Возвраты"
          value={`−${formatMoney(data.returnsTotal)}`}
          color="text-red-500"
        />
        <SummaryCard title="Себестоимость" value={formatMoney(data.cogs)} />
        <SummaryCard
          title="Валовая прибыль"
          value={formatMoney(data.grossProfit)}
          color={data.grossProfit >= 0 ? "text-green-500" : "text-red-500"}
        />
        <SummaryCard
          title="Маржа"
          value={`${data.grossMargin}%`}
          color={data.grossMargin >= 0 ? "text-green-500" : "text-red-500"}
        />
      </div>

      {/* Row 2: Expenses */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <SummaryCard
          title="Списания"
          value={formatMoney(data.writeOffsTotal)}
          color="text-orange-500"
        />
        <SummaryCard
          title="Комиссии банка"
          value={formatMoney(data.bankingFees)}
          color="text-orange-500"
        />
        <SummaryCard
          title="Trade-in расходы"
          value={formatMoney(data.tradeInExpenses)}
          color="text-orange-500"
        />
      </div>

      {/* Row 3: Net profit */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard
          title="Чистая прибыль"
          value={formatMoney(data.netProfit)}
          color={data.netProfit >= 0 ? "text-green-500" : "text-red-500"}
          large
        />
        <SummaryCard
          title="Чистая маржа"
          value={`${data.adjustedRevenue > 0 ? ((data.netProfit / data.adjustedRevenue) * 100).toFixed(1) : "0.0"}%`}
          color={data.netProfit >= 0 ? "text-green-500" : "text-red-500"}
          large
        />
      </div>

      {/* Category breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>По категориям</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Категория</TableHead>
                  <TableHead className="text-right">Выручка</TableHead>
                  <TableHead className="text-right">Себестоимость</TableHead>
                  <TableHead className="text-right">Прибыль</TableHead>
                  <TableHead className="text-right">Маржа</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.categoryBreakdown.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{formatMoney(c.revenue)}</TableCell>
                    <TableCell className="text-right">{formatMoney(c.cogs)}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${c.profit >= 0 ? "text-green-500" : "text-red-500"}`}
                    >
                      {formatMoney(c.profit)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${c.margin >= 0 ? "text-green-500" : "text-red-500"}`}
                    >
                      {c.margin}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data.revenue === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          Нет данных за выбранный период
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  title,
  value,
  color,
  large,
}: {
  title: string
  value: string
  color?: string
  large?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div
          className={`mt-1 font-bold ${large ? "text-2xl font-semibold" : "text-2xl"} ${color || ""}`}
        >
          {value}
        </div>
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
