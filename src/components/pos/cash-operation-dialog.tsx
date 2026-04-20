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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { createCashOperation } from "@/actions/cash-operations"
import { getFunds } from "@/actions/funds"
import { toast } from "sonner"

interface CashOperationDialogProps {
  shiftId: string
  storeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type FundItem = { id: string; name: string; storeName: string | null }

export function CashOperationDialog({
  shiftId,
  storeId,
  open,
  onOpenChange,
  onSuccess,
}: CashOperationDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [type, setType] = useState<"WITHDRAW" | "DEPOSIT">("WITHDRAW")
  const [amount, setAmount] = useState("")
  const [fundId, setFundId] = useState("")
  const [reason, setReason] = useState("")
  const [funds, setFunds] = useState<FundItem[]>([])

  useEffect(() => {
    if (open) {
      setAmount("")
      setFundId("")
      setReason("")
      setType("WITHDRAW")
      getFunds(storeId).then((f) =>
        setFunds(f.filter((fund) => fund.isActive))
      )
    }
  }, [open, storeId])

  function handleSubmit() {
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Укажите корректную сумму")
      return
    }
    if (!reason.trim()) {
      toast.error("Укажите причину")
      return
    }
    if (type === "WITHDRAW" && !fundId) {
      toast.error("Для выемки выберите фонд")
      return
    }

    startTransition(async () => {
      try {
        await createCashOperation({
          shiftId,
          type,
          amount: amountNum,
          fundId: fundId || undefined,
          reason: reason.trim(),
        })
        toast.success(type === "WITHDRAW" ? "Выемка проведена" : "Внесение проведено")
        onOpenChange(false)
        onSuccess()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Операция с наличными</DialogTitle>
          <DialogDescription>Выемка или внесение наличных в кассу</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button
              variant={type === "WITHDRAW" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setType("WITHDRAW")}
            >
              <ArrowUpFromLine className="size-4" />
              Выемка
            </Button>
            <Button
              variant={type === "DEPOSIT" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setType("DEPOSIT")}
            >
              <ArrowDownToLine className="size-4" />
              Внесение
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cash-op-amount">Сумма, ₽</Label>
            <Input
              id="cash-op-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="grid gap-2">
            <Label>Фонд {type === "WITHDRAW" && "*"}</Label>
            <Select value={fundId} onValueChange={(val) => setFundId(val ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите фонд" />
              </SelectTrigger>
              <SelectContent>
                {funds.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                    {f.storeName ? "" : " (глобальный)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cash-op-reason">Причина *</Label>
            <Input
              id="cash-op-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Укажите причину операции"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Провести
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
