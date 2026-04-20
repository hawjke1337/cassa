"use client"

import { useState, useTransition } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Loader2, HandCoins } from "lucide-react"
import { paySupplierDebt } from "@/actions/orders"
import { formatMoney } from "@/lib/format"
import { toast } from "sonner"

interface DebtPaymentDialogProps {
  debtId: string
  debtAmount: string
  totalPaid: string
  orderNumber: string
  onSuccess: () => void
}

export function DebtPaymentDialog({
  debtId,
  debtAmount,
  totalPaid,
  orderNumber,
  onSuccess,
}: DebtPaymentDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const debtAmountNum = parseFloat(debtAmount)
  const totalPaidNum = parseFloat(totalPaid)
  const remaining = debtAmountNum - totalPaidNum

  const [amount, setAmount] = useState(String(remaining))
  const [comment, setComment] = useState("")

  const parsedAmount = parseFloat(amount)
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= remaining + 0.001

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      // Reset form when opening
      setAmount(String(remaining))
      setComment("")
    }
    setOpen(nextOpen)
  }

  function handleConfirm() {
    if (!isValid) return
    startTransition(async () => {
      try {
        await paySupplierDebt(debtId, parsedAmount, comment || undefined)
        toast.success("Оплата зафиксирована")
        setOpen(false)
        onSuccess()
      } catch (err: any) {
        toast.error(err.message || "Ошибка оплаты")
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm">
            <HandCoins className="size-4" />
            Оплатить
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Оплата долга по заказу {orderNumber}</AlertDialogTitle>
          <AlertDialogDescription>Подтвердите оплату долга поставщику</AlertDialogDescription>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between text-sm">
              <span>Сумма долга:</span>
              <span className="font-mono font-medium">{formatMoney(debtAmountNum)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Уже оплачено:</span>
              <span className="font-mono font-medium">{formatMoney(totalPaidNum)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Остаток:</span>
              <span className="font-mono">{formatMoney(remaining)}</span>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Сумма оплаты</Label>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-comment">Комментарий (необязательно)</Label>
            <Textarea
              id="payment-comment"
              placeholder="Комментарий к оплате..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isPending}
              rows={2}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={isPending || !isValid}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Подтвердить оплату
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
