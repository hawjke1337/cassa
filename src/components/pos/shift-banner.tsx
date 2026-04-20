"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, DoorOpen, DoorClosed, Banknote } from "lucide-react"
import { getCurrentShift } from "@/actions/shifts"
import { useCurrentStore } from "@/hooks/use-current-store"
import { OpenShiftDialog } from "./open-shift-dialog"
import { CloseShiftDialog } from "./close-shift-dialog"
import { CashOperationDialog } from "./cash-operation-dialog"

interface ShiftInfo {
  id: string
  number: string
  openedAt: string
  openingCash: number
  openedByName: string
}

export function ShiftBanner() {
  const { currentStoreId } = useCurrentStore()
  const [shift, setShift] = useState<ShiftInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [openDialogOpen, setOpenDialogOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [cashOpDialogOpen, setCashOpDialogOpen] = useState(false)

  const loadShift = useCallback(async () => {
    if (!currentStoreId) return
    try {
      const result = await getCurrentShift(currentStoreId)
      setShift(result)
    } finally {
      setLoading(false)
    }
  }, [currentStoreId])

  useEffect(() => {
    loadShift()
  }, [loadShift])

  if (loading || !currentStoreId) return null

  if (!shift) {
    return (
      <>
        <div className="flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 dark:border-yellow-700 dark:bg-yellow-950">
          <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
            <Clock className="size-4" />
            <span>Смена не открыта</span>
          </div>
          <Button size="sm" onClick={() => setOpenDialogOpen(true)}>
            <DoorOpen className="size-4" />
            Открыть смену
          </Button>
        </div>
        <OpenShiftDialog
          storeId={currentStoreId}
          open={openDialogOpen}
          onOpenChange={setOpenDialogOpen}
          onSuccess={loadShift}
        />
      </>
    )
  }

  const openedTime = new Date(shift.openedAt).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 px-4 py-2 dark:border-green-700 dark:bg-green-950">
        <div className="flex items-center gap-3 text-sm text-green-800 dark:text-green-200">
          <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-300">
            {shift.number}
          </Badge>
          <span>{shift.openedByName}</span>
          <span className="text-muted-foreground">с {openedTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCashOpDialogOpen(true)}
          >
            <Banknote className="size-4" />
            Инкассация
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCloseDialogOpen(true)}
          >
            <DoorClosed className="size-4" />
            Закрыть смену
          </Button>
        </div>
      </div>
      <CloseShiftDialog
        shiftId={shift.id}
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        onSuccess={loadShift}
      />
      <CashOperationDialog
        shiftId={shift.id}
        storeId={currentStoreId}
        open={cashOpDialogOpen}
        onOpenChange={setCashOpDialogOpen}
        onSuccess={loadShift}
      />
    </>
  )
}
