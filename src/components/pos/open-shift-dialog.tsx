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
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle } from "lucide-react"
import { openShift, checkOpenShift } from "@/actions/shifts"
import { toast } from "sonner"

interface OpenShiftDialogProps {
  storeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function OpenShiftDialog({
  storeId,
  open,
  onOpenChange,
  onSuccess,
}: OpenShiftDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [openingCash, setOpeningCash] = useState("")
  const [existingShift, setExistingShift] = useState<{
    number: string
    openedAt: string
  } | null>(null)

  useEffect(() => {
    if (open) {
      setOpeningCash("")
      checkOpenShift(storeId).then((s) => setExistingShift(s))
    }
  }, [open, storeId])

  function handleSubmit() {
    const cash = parseFloat(openingCash)
    if (isNaN(cash) || cash < 0) {
      toast.error("Укажите корректную сумму")
      return
    }

    startTransition(async () => {
      try {
        await openShift({ storeId, openingCash: cash })
        toast.success("Смена открыта")
        onOpenChange(false)
        onSuccess()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка открытия смены")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Открыть смену</DialogTitle>
          <DialogDescription>
            Введите сумму наличных в кассе на начало смены
          </DialogDescription>
        </DialogHeader>

        {existingShift && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm dark:border-yellow-700 dark:bg-yellow-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Есть незакрытая смена
              </p>
              <p className="text-yellow-700 dark:text-yellow-300">
                Смена {existingShift.number} от{" "}
                {new Date(existingShift.openedAt).toLocaleDateString("ru-RU")}{" "}
                будет закрыта автоматически
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-2 py-2">
          <Label htmlFor="opening-cash">Сумма наличных в кассе, ₽</Label>
          <Input
            id="opening-cash"
            type="number"
            min="0"
            step="0.01"
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            placeholder="0"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Открыть смену
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
