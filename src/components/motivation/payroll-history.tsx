"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileDown, ChevronDown, ChevronRight, Loader2 } from "lucide-react"

type PayrollRecord = {
  id: string
  periodStart: string
  periodEnd: string
  isAdvance: boolean
  totalAmount: number
  status: "DRAFT" | "CONFIRMED" | "PAID"
  schemeName: string
  breakdown: unknown
  shiftsCount: number
  dailyTotal: number
  commissions: number
  crossBonuses: number
  repairBonuses: number
  returns: number
  createdAt: string
}

export interface PayrollHistoryProps {
  payrolls: PayrollRecord[]
  onDownloadPdf: (payrollId: string) => void
  loading?: boolean
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatPeriod(start: string, end: string) {
  const s = new Date(start).toLocaleDateString("ru-RU")
  const e = new Date(end).toLocaleDateString("ru-RU")
  return `${s} — ${e}`
}

function statusBadge(status: "DRAFT" | "CONFIRMED" | "PAID") {
  switch (status) {
    case "DRAFT":
      return <Badge variant="secondary">Черновик</Badge>
    case "CONFIRMED":
      return <Badge variant="default">Подтверждён</Badge>
    case "PAID":
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          Выплачен
        </Badge>
      )
  }
}

function typeBadge(isAdvance: boolean) {
  return isAdvance ? <Badge variant="outline">Аванс</Badge> : <Badge variant="default">Итого</Badge>
}

export function PayrollHistory({ payrolls, onDownloadPdf, loading }: PayrollHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (payrolls.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Нет расчётных листов за выбранный период
      </p>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2 font-medium">Период</th>
            <th className="text-left px-4 py-2 font-medium">Тип</th>
            <th className="text-right px-4 py-2 font-medium">Сумма</th>
            <th className="text-left px-4 py-2 font-medium">Статус</th>
            <th className="text-center px-4 py-2 font-medium w-12">PDF</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {payrolls.map((p) => (
            <>
              <tr
                key={p.id}
                onClick={() => toggleRow(p.id)}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {expandedId === p.id ? (
                      <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span>{formatPeriod(p.periodStart, p.periodEnd)}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">{typeBadge(p.isAdvance)}</td>
                <td className="px-4 py-2.5 text-right font-medium">{formatMoney(p.totalAmount)}</td>
                <td className="px-4 py-2.5">{statusBadge(p.status)}</td>
                <td className="px-4 py-2.5 text-center">
                  {(p.status === "CONFIRMED" || p.status === "PAID") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDownloadPdf(p.id)
                      }}
                    >
                      <FileDown className="size-4" />
                    </Button>
                  )}
                </td>
              </tr>
              {expandedId === p.id && (
                <tr key={`${p.id}-details`}>
                  <td colSpan={5} className="px-8 py-3 bg-muted/20 text-xs text-muted-foreground">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 max-w-md">
                      <span>
                        Смены: <strong className="text-foreground">{p.shiftsCount}</strong>
                      </span>
                      <span>
                        Ставка:{" "}
                        <strong className="text-foreground">{formatMoney(p.dailyTotal)}</strong>
                      </span>
                      <span>
                        Комиссия:{" "}
                        <strong className="text-foreground">{formatMoney(p.commissions)}</strong>
                      </span>
                      <span>
                        Кросс-бонусы:{" "}
                        <strong className="text-foreground">{formatMoney(p.crossBonuses)}</strong>
                      </span>
                      <span>
                        Ремонт:{" "}
                        <strong className="text-foreground">{formatMoney(p.repairBonuses)}</strong>
                      </span>
                      <span>
                        Возвраты:{" "}
                        <strong className="text-foreground text-red-600">
                          -{formatMoney(p.returns)}
                        </strong>
                      </span>
                    </div>
                    <p className="mt-1 text-xs">Схема: {p.schemeName}</p>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
