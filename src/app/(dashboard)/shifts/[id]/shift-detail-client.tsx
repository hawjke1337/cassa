"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Printer } from "lucide-react"
import { getShift, getShiftSummary } from "@/actions/shifts"
import { formatMoney, formatDuration } from "@/lib/format"

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Открыта",
  CLOSED: "Закрыта",
  AUTO_CLOSED: "Не закрыта",
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
  AUTO_CLOSED: "bg-red-100 text-red-800",
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  SBP: "СБП",
  TRANSFER: "Перевод",
  CREDIT: "Рассрочка",
}

const CASH_OP_TYPE_LABELS: Record<string, string> = {
  WITHDRAW: "Выемка",
  DEPOSIT: "Внесение",
}

type ShiftData = Awaited<ReturnType<typeof getShift>>
type SummaryData = Awaited<ReturnType<typeof getShiftSummary>>

interface ShiftDetailClientProps {
  shiftId: string
}

export function ShiftDetailClient({ shiftId }: ShiftDetailClientProps) {
  const [shift, setShift] = useState<ShiftData | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getShift(shiftId), getShiftSummary(shiftId)])
      .then(([shiftData, summaryData]) => {
        setShift(shiftData)
        setSummary(summaryData)
      })
      .finally(() => setLoading(false))
  }, [shiftId])

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })

  const formatDateFull = (iso: string) =>
    new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!shift) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Смена не найдена
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/shifts">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{shift.number}</h1>
              <Badge className={STATUS_COLORS[shift.status] ?? ""}>
                {STATUS_LABELS[shift.status] ?? shift.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {shift.storeName} | {formatDateFull(shift.openedAt)}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`/print/shift/${shiftId}`, "_blank")}
        >
          <Printer className="size-4" />
          Печать
        </Button>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Магазин</p>
          <p className="font-medium">{shift.storeName}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Открыл</p>
          <p className="font-medium">{shift.openedByName}</p>
          <p className="text-xs text-muted-foreground">{formatTime(shift.openedAt)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Закрыл</p>
          <p className="font-medium">{shift.closedByName ?? "—"}</p>
          {shift.closedAt && (
            <p className="text-xs text-muted-foreground">{formatTime(shift.closedAt)}</p>
          )}
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Время работы</p>
          <p className="font-medium">
            {shift.closedAt
              ? formatDuration(
                  Math.round(
                    (new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime()) /
                      60000,
                  ),
                )
              : "В процессе"}
          </p>
        </div>
      </div>

      {/* Cash Summary */}
      {summary && (
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 text-lg font-semibold">Итоги по наличным</h2>

          {shift.status === "AUTO_CLOSED" ? (
            <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
              Смена не была закрыта вручную. Данные по фактическим наличным отсутствуют.
            </div>
          ) : null}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Наличные на начало</span>
              <span>{formatMoney(summary.openingCash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Продажи (нал.)</span>
              <span className="text-green-600">+{formatMoney(summary.cashIncome)}</span>
            </div>
            {summary.deposits > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Внесения</span>
                <span className="text-green-600">+{formatMoney(summary.deposits)}</span>
              </div>
            )}
            {summary.cashExpenses > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Расходы (нал.)</span>
                <span className="text-red-600">−{formatMoney(summary.cashExpenses)}</span>
              </div>
            )}
            {summary.withdrawals > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Выемки</span>
                <span className="text-red-600">−{formatMoney(summary.withdrawals)}</span>
              </div>
            )}
            {summary.cashRefunds > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Возвраты (нал.)</span>
                <span className="text-red-600">−{formatMoney(summary.cashRefunds)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Ожидаемая сумма</span>
              <span>{formatMoney(summary.expectedCash)}</span>
            </div>
            {shift.closingCash !== null && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Фактическая сумма</span>
                  <span>{formatMoney(shift.closingCash)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Расхождение</span>
                  <span className={shift.discrepancy === 0 ? "text-green-600" : "text-red-600"}>
                    {shift.discrepancy !== null && shift.discrepancy > 0 ? "+" : ""}
                    {shift.discrepancy !== null ? formatMoney(shift.discrepancy) : "—"}
                  </span>
                </div>
                {shift.note && (
                  <div className="mt-2 rounded bg-muted p-2 text-xs">
                    <span className="font-medium">Комментарий:</span> {shift.note}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Payment method breakdown */}
          {summary.paymentsByMethod.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">По способам оплаты</h3>
              <div className="space-y-1 text-sm">
                {summary.paymentsByMethod.map((pm) => (
                  <div key={pm.method} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {METHOD_LABELS[pm.method] ?? pm.method}
                    </span>
                    <span>{formatMoney(pm.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sales */}
      {shift.sales.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Продажи ({shift.sales.length})</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Номер</TableHead>
                <TableHead>Время</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Оплата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shift.sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono text-sm">{sale.number}</TableCell>
                  <TableCell className="text-sm">{formatTime(sale.createdAt)}</TableCell>
                  <TableCell className="text-right text-sm">{formatMoney(sale.amount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sale.payments.map((p) => METHOD_LABELS[p.method] ?? p.method).join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Returns */}
      {shift.returns.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Возвраты ({shift.returns.length})</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Номер</TableHead>
                <TableHead>Время</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Способ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shift.returns.map((ret) => (
                <TableRow key={ret.id}>
                  <TableCell className="font-mono text-sm">{ret.number}</TableCell>
                  <TableCell className="text-sm">{formatTime(ret.createdAt)}</TableCell>
                  <TableCell className="text-right text-sm text-red-600">
                    −{formatMoney(ret.amount)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ret.refundMethod ? (METHOD_LABELS[ret.refundMethod] ?? ret.refundMethod) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Cash Operations */}
      {shift.cashOperations.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Кассовые операции ({shift.cashOperations.length})</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Время</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Фонд</TableHead>
                <TableHead>Причина</TableHead>
                <TableHead>Кто</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shift.cashOperations.map((op) => (
                <TableRow key={op.id}>
                  <TableCell className="text-sm">{formatTime(op.createdAt)}</TableCell>
                  <TableCell className="text-sm">
                    <Badge variant={op.type === "WITHDRAW" ? "destructive" : "secondary"}>
                      {CASH_OP_TYPE_LABELS[op.type] ?? op.type}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right text-sm ${op.type === "WITHDRAW" ? "text-red-600" : "text-green-600"}`}
                  >
                    {op.type === "WITHDRAW" ? "−" : "+"}
                    {formatMoney(op.amount)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {op.fundName ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{op.reason}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {op.performedByName}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
