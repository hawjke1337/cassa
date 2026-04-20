"use client"

import { useState, useEffect, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"
import { getShiftSummary, closeShift } from "@/actions/shifts"
import { formatMoney } from "@/lib/format"
import { toast } from "sonner"
import { useCriticalToast } from "@/hooks/use-critical-toast"

const METHOD_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  SBP: "СБП",
  TRANSFER: "Перевод",
  CREDIT: "Рассрочка",
}

interface CloseShiftDialogProps {
  shiftId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Summary = Awaited<ReturnType<typeof getShiftSummary>>

export function CloseShiftDialog({
  shiftId,
  open,
  onOpenChange,
  onSuccess,
}: CloseShiftDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [closingCash, setClosingCash] = useState("")
  const [note, setNote] = useState("")
  // UX2-03: AlertDialog требует явного подтверждения при расхождении —
  // страхует от ошибочного ввода суммы оператором.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const criticalToast = useCriticalToast()

  useEffect(() => {
    if (open) {
      setClosingCash("")
      setNote("")
      setLoadingSummary(true)
      getShiftSummary(shiftId)
        .then(setSummary)
        .finally(() => setLoadingSummary(false))
    }
  }, [open, shiftId])

  const closingCashNum = parseFloat(closingCash) || 0
  const discrepancy = summary ? +(closingCashNum - summary.expectedCash).toFixed(2) : 0
  const hasDiscrepancy = closingCash !== "" && discrepancy !== 0

  /**
   * UX2-03: handleInitiateClose выполняет базовые проверки и, если есть
   * расхождение, открывает AlertDialog для явного подтверждения. При
   * нулевом расхождении сразу идём в closeShift.
   */
  function handleInitiateClose() {
    if (closingCash === "") {
      toast.error("Укажите фактическую сумму наличных")
      return
    }
    if (hasDiscrepancy && !note.trim()) {
      toast.error("При расхождении укажите комментарий")
      return
    }
    if (hasDiscrepancy) {
      setConfirmOpen(true)
      return
    }
    performClose()
  }

  function performClose() {
    setConfirmOpen(false)
    startTransition(async () => {
      try {
        await closeShift({
          shiftId,
          closingCash: closingCashNum,
          note: note.trim() || undefined,
        })
        toast.success("Смена закрыта")
        onOpenChange(false)
        onSuccess()
      } catch (err) {
        // UX2-05: закрытие смены — критичная операция (финансовая
        // фиксация). Показываем retry toast — оператор может попробовать
        // снова без повторного ввода.
        criticalToast.error("Ошибка закрытия смены", {
          description: err instanceof Error ? err.message : undefined,
          retry: performClose,
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Закрыть смену</DialogTitle>
          <DialogDescription>Проверьте итоги смены и введите фактическую сумму</DialogDescription>
        </DialogHeader>

        {loadingSummary ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : summary ? (
          <div className="space-y-4 py-2">
            {/* Payment method breakdown */}
            <div>
              <p className="mb-2 text-sm font-medium">
                Продажи за смену ({summary.salesCount} шт.)
              </p>
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

            {summary.returnsCount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Возвраты ({summary.returnsCount})</span>
                <span className="text-red-600">−{formatMoney(summary.returnsTotal)}</span>
              </div>
            )}

            {(summary.withdrawals > 0 || summary.deposits > 0) && (
              <div className="space-y-1 text-sm">
                {summary.withdrawals > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Выемки</span>
                    <span className="text-red-600">−{formatMoney(summary.withdrawals)}</span>
                  </div>
                )}
                {summary.deposits > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Внесения</span>
                    <span className="text-green-600">+{formatMoney(summary.deposits)}</span>
                  </div>
                )}
              </div>
            )}

            <Separator />

            <div className="flex justify-between text-sm font-bold">
              <span>Ожидаемая сумма наличных</span>
              <span className="text-lg">{formatMoney(summary.expectedCash)}</span>
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label htmlFor="closing-cash">Фактическая сумма наличных, ₽</Label>
              <Input
                id="closing-cash"
                type="number"
                min="0"
                step="0.01"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>

            {closingCash !== "" && (
              <div
                className={`flex justify-between rounded-lg p-2 text-sm font-medium ${
                  discrepancy === 0
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                <span>Расхождение</span>
                <span>
                  {discrepancy > 0 ? "+" : ""}
                  {formatMoney(discrepancy)}
                </span>
              </div>
            )}

            {hasDiscrepancy && (
              <div className="grid gap-2">
                <Label htmlFor="close-note">Комментарий к расхождению *</Label>
                <Textarea
                  id="close-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Объясните причину расхождения..."
                />
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={handleInitiateClose} disabled={isPending || loadingSummary}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Закрыть смену
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* UX2-03: Подтверждение расхождения перед финальным submit. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердите расхождение</AlertDialogTitle>
            <AlertDialogDescription>
              В кассе обнаружено расхождение <b>{formatMoney(discrepancy)}</b> против ожидаемой
              суммы <b>{formatMoney(summary?.expectedCash ?? 0)}</b>. Убедитесь, что комментарий
              корректно описывает причину. После закрытия смены отменить операцию нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={performClose}
            >
              Закрыть с расхождением
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
