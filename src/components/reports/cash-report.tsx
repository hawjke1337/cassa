"use client"

import { useState, useEffect, useTransition } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { getCashReport } from "@/actions/reports"
import { formatMoney } from "@/lib/format"

type CashReportData = Awaited<ReturnType<typeof getCashReport>>

const METHOD_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  SBP: "СБП",
  TRANSFER: "Перевод",
  CREDIT: "Рассрочка",
}

interface CashReportProps {
  storeId: string
  dateFrom: string
  dateTo: string
}

export function CashReport({ storeId, dateFrom, dateTo }: CashReportProps) {
  const [data, setData] = useState<CashReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!storeId || !dateFrom || !dateTo) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await getCashReport({ storeId, dateFrom, dateTo })
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
    return <CashReportSkeleton />
  }

  if (data.shifts.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">Нет данных за выбранный период</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Выберите период, в котором были открытые смены
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary strip — totals by payment method */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {data.totals!.methods.map((m) => (
          <Card key={m.method}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {METHOD_LABELS[m.method]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatMoney(m.net)}</p>
              <p className="text-xs text-muted-foreground">{m.txCount} операций</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-shift breakdown cards */}
      {data.shifts.map((shift) => (
        <Card key={shift.shiftId}>
          <CardHeader>
            <CardTitle className="text-lg">
              Смена #{shift.shiftNumber} &mdash; {shift.cashierName} &mdash;{" "}
              {new Date(shift.openedAt).toLocaleDateString("ru-RU")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Метод оплаты</TableHead>
                  <TableHead className="text-right">Кол-во операций</TableHead>
                  <TableHead className="text-right">Приход</TableHead>
                  <TableHead className="text-right">Расход</TableHead>
                  <TableHead className="text-right">Итого</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shift.methods.map((m) => (
                  <TableRow key={m.method}>
                    <TableCell>
                      <Badge variant="outline">{METHOD_LABELS[m.method]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{m.txCount}</TableCell>
                    <TableCell className="text-right">{formatMoney(m.inflow)}</TableCell>
                    <TableCell className="text-right">{formatMoney(m.outflow)}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(m.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Separator />
            {shift.reconciliation.actualCash !== null && (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Ожидаемый остаток</p>
                  <p className="text-lg font-semibold">
                    {formatMoney(shift.reconciliation.expectedCash)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Фактический остаток</p>
                  <p className="text-lg font-semibold">
                    {formatMoney(shift.reconciliation.actualCash)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Расхождение</p>
                  <p
                    className={`text-lg font-semibold ${
                      shift.reconciliation.discrepancy === 0
                        ? "text-green-600"
                        : (shift.reconciliation.discrepancy ?? 0) < 0
                          ? "text-red-600"
                          : "text-green-600"
                    }`}
                  >
                    {shift.reconciliation.discrepancy === 0
                      ? "Расхождений нет"
                      : formatMoney(shift.reconciliation.discrepancy ?? 0)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Period totals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Итого за период</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Метод оплаты</TableHead>
                <TableHead className="text-right">Кол-во операций</TableHead>
                <TableHead className="text-right">Приход</TableHead>
                <TableHead className="text-right">Расход</TableHead>
                <TableHead className="text-right">Итого</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.totals!.methods.map((m) => (
                <TableRow key={m.method}>
                  <TableCell>
                    <Badge variant="outline">{METHOD_LABELS[m.method]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{m.txCount}</TableCell>
                  <TableCell className="text-right">{formatMoney(m.inflow)}</TableCell>
                  <TableCell className="text-right">{formatMoney(m.outflow)}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(m.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator />
          <div className="text-sm">
            <p className="text-muted-foreground">Суммарное расхождение за период</p>
            <p
              className={`text-lg font-semibold ${
                data.totals!.totalDiscrepancy === 0
                  ? "text-green-600"
                  : data.totals!.totalDiscrepancy < 0
                    ? "text-red-600"
                    : "text-green-600"
              }`}
            >
              {data.totals!.totalDiscrepancy === 0
                ? "Расхождений нет"
                : formatMoney(data.totals!.totalDiscrepancy)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CashReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-8 w-24" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
