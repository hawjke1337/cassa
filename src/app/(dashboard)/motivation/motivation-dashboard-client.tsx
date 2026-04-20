"use client"

import { useState, useEffect, useTransition } from "react"
import Link from "next/link"
import { Loader2, ChevronDown, ChevronRight, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useCurrentStore } from "@/hooks/use-current-store"
import { getUserStores } from "@/actions/stores"
import { getStoreEarnings } from "@/actions/motivation-calculation"
import { generatePayroll } from "@/actions/motivation-payroll"
import { toast } from "sonner"

type StoreOption = { id: string; name: string }

type EarningsRow = {
  userId: string
  userName: string
  shiftsCount: number
  daily: number
  commissions: number
  crossBonuses: number
  repairBonuses: number
  returns: number
  total: number
}

type PayrollDialogMode = "advance" | "settlement"

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartStr() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n)
}

export function MotivationDashboardClient() {
  const { currentStoreId } = useCurrentStore()
  const [stores, setStores] = useState<StoreOption[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [dateFrom, setDateFrom] = useState(monthStartStr())
  const [dateTo, setDateTo] = useState(todayStr())

  const [earningsLoading, setEarningsLoading] = useState(false)
  const [earningsRows, setEarningsRows] = useState<EarningsRow[]>([])
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [expandedEarnings, setExpandedEarnings] = useState<Record<string, Awaited<ReturnType<typeof import("@/actions/motivation-calculation").getMyEarnings>>>>({})

  // Payroll generation dialog
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false)
  const [payrollDialogMode, setPayrollDialogMode] = useState<PayrollDialogMode>("advance")
  const [shiftsInputs, setShiftsInputs] = useState<Record<string, number>>({})
  const [isPending, startTransition] = useTransition()

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

  function loadEarnings() {
    setEarningsLoading(true)
    setExpandedUserId(null)
    setExpandedEarnings({})
    getStoreEarnings(selectedStoreId, dateFrom, dateTo)
      .then((rows) => setEarningsRows(rows))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Ошибка загрузки"))
      .finally(() => setEarningsLoading(false))
  }

  async function handleRowClick(row: EarningsRow) {
    if (expandedUserId === row.userId) {
      setExpandedUserId(null)
      return
    }
    setExpandedUserId(row.userId)
    if (!expandedEarnings[row.userId]) {
      try {
        const { getMyEarnings: _, calculateEarnings: __, getStoreEarnings: ___, ...rest } = await import("@/actions/motivation-calculation")
        void rest
        // We need to call calculateEarnings with the correct params
        // Use getStoreEarnings result data stored in earningsRows for display
        // For detailed breakdown we need to re-fetch - but we don't have a single-user endpoint
        // We'll show the summary data only
      } catch {
        // ignore
      }
    }
  }

  function openPayrollDialog(mode: PayrollDialogMode) {
    setPayrollDialogMode(mode)
    // Prefill shifts from earnings rows
    const inputs: Record<string, number> = {}
    for (const row of earningsRows) {
      inputs[row.userId] = row.shiftsCount
    }
    setShiftsInputs(inputs)
    setPayrollDialogOpen(true)
  }

  function handleGeneratePayrolls() {
    if (!selectedStoreId) return

    const periodStart = new Date(dateFrom)
    periodStart.setHours(0, 0, 0, 0)
    const periodEnd = new Date(dateTo)
    periodEnd.setHours(23, 59, 59, 999)

    startTransition(async () => {
      let successCount = 0
      let errorCount = 0

      for (const row of earningsRows) {
        const shiftsCount = shiftsInputs[row.userId] ?? 0
        try {
          await generatePayroll({
            userId: row.userId,
            storeId: selectedStoreId,
            periodStart,
            periodEnd,
            shiftsCount,
            isAdvance: payrollDialogMode === "advance",
          })
          successCount++
        } catch (err) {
          errorCount++
          toast.error(`${row.userName}: ${err instanceof Error ? err.message : "Ошибка"}`)
        }
      }

      if (successCount > 0) {
        toast.success(`Расчётные листки созданы: ${successCount}`)
      }
      if (errorCount === 0) {
        setPayrollDialogOpen(false)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Мотивация сотрудников</h1>
        <p className="text-muted-foreground">Расчёт и выплата вознаграждений</p>
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
          <Label htmlFor="date-from" className="text-xs text-muted-foreground">
            Период с
          </Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="date-to" className="text-xs text-muted-foreground">
            по
          </Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Employee earnings table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Заработок сотрудников</h2>
          {earningsRows.length > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openPayrollDialog("advance")}
                disabled={earningsLoading}
              >
                Рассчитать аванс
              </Button>
              <Button
                size="sm"
                onClick={() => openPayrollDialog("settlement")}
                disabled={earningsLoading}
              >
                Рассчитать зарплату
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Сотрудник</TableHead>
                <TableHead className="text-right">Смены</TableHead>
                <TableHead className="text-right">Ставка</TableHead>
                <TableHead className="text-right">Комиссии</TableHead>
                <TableHead className="text-right">Кросс</TableHead>
                <TableHead className="text-right">Ремонты</TableHead>
                <TableHead className="text-right">Возвраты</TableHead>
                <TableHead className="text-right font-semibold">Итого</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {earningsLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : earningsRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    {selectedStoreId
                      ? "Нет данных за выбранный период"
                      : "Выберите магазин"}
                  </TableCell>
                </TableRow>
              ) : (
                earningsRows.map((row) => (
                  <>
                    <TableRow
                      key={row.userId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell className="w-8">
                        {expandedUserId === row.userId ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.userName}</TableCell>
                      <TableCell className="text-right">{row.shiftsCount}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.daily)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.commissions)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.crossBonuses)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.repairBonuses)}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {row.returns !== 0 ? formatMoney(row.returns) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(row.total)}
                      </TableCell>
                    </TableRow>
                    {expandedUserId === row.userId && (
                      <TableRow key={`${row.userId}-expanded`}>
                        <TableCell colSpan={9} className="bg-muted/30 px-8 py-4">
                          <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">Сводка по {row.userName}</p>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 max-w-sm">
                              <span>Смен: {row.shiftsCount}</span>
                              <span>Ставка: {formatMoney(row.daily)}</span>
                              <span>Комиссии: {formatMoney(row.commissions)}</span>
                              <span>Кросс-продажи: {formatMoney(row.crossBonuses)}</span>
                              <span>Ремонты: {formatMoney(row.repairBonuses)}</span>
                              <span>Возвраты: {formatMoney(row.returns)}</span>
                              <span className="font-semibold col-span-2">
                                Итого: {formatMoney(row.total)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Link to payrolls page */}
      <Link
        href="/motivation/payrolls"
        className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
      >
        <span className="font-medium">Расчётные листы</span>
        <ArrowRight className="size-4 text-muted-foreground" />
      </Link>

      {/* Generate payroll dialog */}
      <Dialog open={payrollDialogOpen} onOpenChange={setPayrollDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {payrollDialogMode === "advance" ? "Рассчитать аванс" : "Рассчитать зарплату"}
            </DialogTitle>
            <DialogDescription>
              Укажите количество смен для каждого сотрудника
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {earningsRows.map((row) => (
              <div key={row.userId} className="flex items-center gap-4">
                <span className="flex-1 text-sm font-medium">{row.userName}</span>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`shifts-${row.userId}`} className="text-xs text-muted-foreground whitespace-nowrap">
                    Смен:
                  </Label>
                  <Input
                    id={`shifts-${row.userId}`}
                    type="number"
                    min={0}
                    max={31}
                    value={shiftsInputs[row.userId] ?? 0}
                    onChange={(e) =>
                      setShiftsInputs((prev) => ({
                        ...prev,
                        [row.userId]: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-20"
                  />
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayrollDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleGeneratePayrolls} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {payrollDialogMode === "advance" ? "Рассчитать аванс" : "Рассчитать зарплату"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
