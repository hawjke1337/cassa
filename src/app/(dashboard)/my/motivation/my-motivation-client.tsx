"use client"

import { useState, useEffect } from "react"
import { Loader2, TrendingUp, CalendarDays, ShoppingCart } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCurrentStore } from "@/hooks/use-current-store"
import { getUserStores } from "@/actions/stores"
import { getMyEarnings } from "@/actions/motivation-calculation"
import { getMyPayrolls, getPayrollPdfData } from "@/actions/motivation-payroll"
import { EarningsBreakdown } from "@/components/motivation/earnings-breakdown"
import { PayrollHistory } from "@/components/motivation/payroll-history"
import { toast } from "sonner"
import { pdf } from "@react-pdf/renderer"
import { PayrollPdfDocument } from "@/components/motivation/payroll-pdf-document"

type StoreOption = { id: string; name: string }
type EarningsResult = Awaited<ReturnType<typeof getMyEarnings>>

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartStr() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n)
}

export function MyMotivationClient() {
  const { currentStoreId } = useCurrentStore()
  const [stores, setStores] = useState<StoreOption[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [dateFrom, setDateFrom] = useState(monthStartStr())
  const [dateTo, setDateTo] = useState(todayStr())

  const [loading, setLoading] = useState(false)
  const [earnings, setEarnings] = useState<EarningsResult>(null)
  const [payrolls, setPayrolls] = useState<Awaited<ReturnType<typeof getMyPayrolls>>>([])
  const [payrollsLoading, setPayrollsLoading] = useState(false)

  // Load stores
  useEffect(() => {
    getUserStores().then((s) => {
      setStores(s)
      if (currentStoreId) {
        setSelectedStoreId(currentStoreId)
      } else if (s.length > 0) {
        setSelectedStoreId(s[0].id)
      }
    })
  }, [currentStoreId])

  // Load earnings when store/period changes
  useEffect(() => {
    if (!selectedStoreId) return
    loadEarnings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, dateFrom, dateTo])

  useEffect(() => {
    if (!selectedStoreId) return
    setPayrollsLoading(true)
    getMyPayrolls(selectedStoreId)
      .then(setPayrolls)
      .catch(() => toast.error("Не удалось загрузить историю начислений"))
      .finally(() => setPayrollsLoading(false))
  }, [selectedStoreId])

  async function handleDownloadPdf(payrollId: string) {
    try {
      const data = await getPayrollPdfData(payrollId)
      const blob = await pdf(
        <PayrollPdfDocument
          userName={data.userName}
          storeName={data.storeName}
          periodStart={data.periodStart}
          periodEnd={data.periodEnd}
          isAdvance={data.isAdvance}
          breakdown={data.breakdown as any}
          advanceAmount={data.advanceAmount}
        />,
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `payroll-${payrollId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Не удалось скачать PDF")
    }
  }

  function loadEarnings() {
    setLoading(true)
    getMyEarnings(selectedStoreId, dateFrom, dateTo)
      .then((data) => setEarnings(data))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Ошибка загрузки"))
      .finally(() => setLoading(false))
  }

  const salesCount = earnings ? earnings.commissions.length : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Моя мотивация</h1>
        <p className="text-muted-foreground">Ваш заработок за выбранный период</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        {stores.length > 1 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Магазин</Label>
            <Select value={selectedStoreId} onValueChange={(v) => setSelectedStoreId(v ?? "")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Выберите магазин" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="my-date-from" className="text-xs text-muted-foreground">
            Период с
          </Label>
          <Input
            id="my-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="my-date-to" className="text-xs text-muted-foreground">
            по
          </Label>
          <Input
            id="my-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>

        {/* PDF download moved to PayrollHistory table */}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedStoreId ? (
        <div className="py-16 text-center text-muted-foreground">Выберите магазин</div>
      ) : !earnings ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-amber-400">
          Нет назначенной схемы мотивации на выбранный период. Обратитесь к руководителю.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="size-4" />
                <span className="text-sm">Итого начислено</span>
              </div>
              <p className="text-2xl font-bold">{formatMoney(earnings.totals.total)}</p>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="size-4" />
                <span className="text-sm">Смен отработано</span>
              </div>
              <p className="text-2xl font-bold">{earnings.dailyRate.shiftsCount}</p>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShoppingCart className="size-4" />
                <span className="text-sm">Продаж совершено</span>
              </div>
              <p className="text-2xl font-bold">{salesCount}</p>
            </div>
          </div>

          {/* Detailed breakdown */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold">Детализация</h2>
            <EarningsBreakdown earnings={earnings} />
          </div>

          {/* История начислений */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">История начислений</h2>
            <PayrollHistory
              payrolls={payrolls}
              onDownloadPdf={handleDownloadPdf}
              loading={payrollsLoading}
            />
          </div>
        </>
      )}
    </div>
  )
}
