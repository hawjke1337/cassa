"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useCart } from "@/hooks/use-cart"
import { useCurrentStore } from "@/hooks/use-current-store"
import { createSale } from "@/actions/sales"
import { getStoreFeeRates } from "@/actions/fee-settings"
import { calcBankingFee } from "@/lib/money"
import { formatMoney } from "@/lib/format"
import { toast } from "sonner"
import { useCriticalToast } from "@/hooks/use-critical-toast"
import { Loader2, CreditCard, Banknote, Smartphone, ArrowRightLeft, Clock } from "lucide-react"
import { ReceiptView } from "./receipt-view"

type PaymentMethodType = "CASH" | "CARD" | "SBP" | "TRANSFER" | "CREDIT"

const METHODS: { value: PaymentMethodType; label: string; icon: React.ReactNode }[] = [
  { value: "CASH", label: "Наличные", icon: <Banknote className="size-4" /> },
  { value: "CARD", label: "Карта", icon: <CreditCard className="size-4" /> },
  { value: "SBP", label: "СБП", icon: <Smartphone className="size-4" /> },
  { value: "TRANSFER", label: "Перевод", icon: <ArrowRightLeft className="size-4" /> },
  { value: "CREDIT", label: "Рассрочка", icon: <Clock className="size-4" /> },
]

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SaleResult = Awaited<ReturnType<typeof createSale>>

export function PaymentDialog({ open, onOpenChange }: PaymentDialogProps) {
  const { items, getTotal, getDiscountTotal, clearCart } = useCart()
  const { currentStoreId } = useCurrentStore()

  const [activeMethod, setActiveMethod] = useState<PaymentMethodType>("CASH")
  const [cashReceived, setCashReceived] = useState("")
  const [isCombined, setIsCombined] = useState(false)
  const [combinedAmounts, setCombinedAmounts] = useState<Record<PaymentMethodType, string>>({
    CASH: "",
    CARD: "",
    SBP: "",
    TRANSFER: "",
    CREDIT: "",
  })
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [receipt, setReceipt] = useState<SaleResult | null>(null)
  const [feeRates, setFeeRates] = useState<Record<string, number>>({})

  // UX2-02: ref-lock предотвращает double-submit при быстром повторном клике.
  // В отличие от `loading` state (асинхронно обновляется на следующем рендере),
  // lockRef виден синхронно и блокирует второй onClick ДО setState.
  const lockRef = useRef(false)

  // UX2-06: Идемпотентный ключ регенерируется при каждом открытии диалога.
  // Server-side проверка (createSale → tx.sale.findUnique) гарантирует,
  // что повторные submit-ы с тем же ключом вернут существующую Sale,
  // защищая от дублей при refresh / retry во время in-flight запроса.
  const [idempotencyKey, setIdempotencyKey] = useState<string>("")

  const criticalToast = useCriticalToast()

  const total = getTotal()
  const discount = getDiscountTotal()
  const finalAmount = total - discount

  const cashAmount = Number(cashReceived) || 0
  const change = cashAmount - finalAmount

  const combinedTotal = Object.values(combinedAmounts).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0,
  )

  const resetState = useCallback(() => {
    setCashReceived("")
    setComment("")
    setIsCombined(false)
    setCombinedAmounts({ CASH: "", CARD: "", SBP: "", TRANSFER: "", CREDIT: "" })
    setActiveMethod("CASH")
    setReceipt(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open && currentStoreId) {
      getStoreFeeRates(currentStoreId)
        .then(setFeeRates)
        .catch(() => {})
    }
  }, [open, currentStoreId])

  // UX2-06: Новый UUID при каждом открытии диалога.
  // Критично: если оператор закрыл и снова открыл PaymentDialog,
  // должен быть создан НОВЫЙ Sale, а не возвращён предыдущий.
  // Одновременно сбрасываем lockRef на случай залипания.
  useEffect(() => {
    if (open) {
      setIdempotencyKey(
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : // Fallback для старых сред (не должно срабатывать в prod).
            `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      )
      lockRef.current = false
    }
  }, [open])

  // Compute fee for current single-method selection
  const currentRate = !isCombined && activeMethod !== "CASH" ? (feeRates[activeMethod] ?? 0) : 0
  const feeResult =
    currentRate > 0
      ? calcBankingFee(finalAmount, currentRate)
      : { fee: { toFixed: () => "0" }, total: { toFixed: () => String(finalAmount) } }
  const singleFee = Number((feeResult.fee as any).toFixed(2))
  const singleTotalWithFee = Number((feeResult.total as any).toFixed(2))

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      resetState()
    }
    onOpenChange(isOpen)
  }

  function buildPayments(): { method: PaymentMethodType; amount: number }[] {
    if (isCombined) {
      const payments: { method: PaymentMethodType; amount: number }[] = []
      for (const m of METHODS) {
        const amt = Number(combinedAmounts[m.value]) || 0
        if (amt > 0) {
          payments.push({ method: m.value, amount: amt })
        }
      }
      return payments
    }
    if (activeMethod === "CASH") {
      return [{ method: "CASH", amount: finalAmount }]
    }
    return [{ method: activeMethod, amount: finalAmount }]
  }

  async function handleConfirm() {
    // UX2-02: synchronous re-entry guard.
    // Если click зашёл повторно пока первый submit ещё в полёте — выходим.
    if (lockRef.current) return

    if (!currentStoreId) {
      toast.error("Выберите магазин")
      return
    }
    if (items.length === 0) {
      toast.error("Корзина пуста")
      return
    }

    if (isCombined && combinedTotal < finalAmount) {
      toast.error("Сумма оплаты меньше суммы чека")
      return
    }
    if (!isCombined && activeMethod === "CASH" && cashAmount < finalAmount && cashReceived !== "") {
      toast.error("Недостаточная сумма наличных")
      return
    }

    const payments = buildPayments()
    if (payments.length === 0) {
      toast.error("Не указан способ оплаты")
      return
    }

    lockRef.current = true
    setLoading(true)
    try {
      const result = await createSale({
        storeId: currentStoreId,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          costPrice: item.costPrice,
          discount: item.discount,
          serialUnitId: item.serialUnitId ?? null,
        })),
        payments,
        cashReceived: activeMethod === "CASH" && !isCombined ? cashAmount || undefined : undefined,
        changeAmount:
          activeMethod === "CASH" && !isCombined && cashAmount > finalAmount
            ? cashAmount - finalAmount
            : undefined,
        comment: comment.trim() || undefined,
        // UX2-06: сохранённый ключ одинаков для всех retry этого диалога.
        idempotencyKey: idempotencyKey || undefined,
      })

      toast.success(`Продажа ${result.number} оформлена`)
      clearCart()
      setReceipt(result)
    } catch (err) {
      // UX2-05: Sale — критичная операция; даём кнопку "Повторить".
      // Повтор безопасен: idempotencyKey защищает от дубля если первый
      // запрос всё-таки дошёл до БД до ошибки.
      criticalToast.error("Ошибка при оформлении продажи", {
        description: err instanceof Error ? err.message : undefined,
        retry: handleConfirm,
      })
    } finally {
      lockRef.current = false
      setLoading(false)
    }
  }

  function handleCombinedChange(method: PaymentMethodType, value: string) {
    setCombinedAmounts((prev) => ({ ...prev, [method]: value }))
  }

  // Show receipt after successful sale
  if (receipt) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md" aria-label={`Чек продажи ${receipt.number}`}>
          <DialogHeader>
            <DialogTitle>Чек #{receipt.number}</DialogTitle>
            <DialogDescription>Продажа успешно оформлена</DialogDescription>
          </DialogHeader>
          <ReceiptView data={receipt} onClose={() => handleClose(false)} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" aria-label="Диалог оплаты">
        <DialogHeader>
          <DialogTitle>Оплата</DialogTitle>
          <DialogDescription>Выберите способ оплаты</DialogDescription>
        </DialogHeader>

        {/* Final amount display */}
        <div className="rounded-lg bg-muted p-4 text-center">
          <p className="text-sm text-muted-foreground">К оплате</p>
          <p className="text-3xl font-bold">{formatMoney(finalAmount)}</p>
          {discount > 0 && (
            <p className="text-sm text-muted-foreground">Скидка: {formatMoney(discount)}</p>
          )}
        </div>

        {/* Combined payment toggle */}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={isCombined}
            onCheckedChange={(checked) => setIsCombined(checked === true)}
          />
          Комбинированная оплата
        </label>

        {isCombined ? (
          /* Combined payment inputs */
          <div className="space-y-2">
            {METHODS.map((m) => (
              <div key={m.value} className="flex items-center gap-2">
                <span className="flex w-24 items-center gap-1 text-sm">
                  {m.icon}
                  {m.label}
                </span>
                <Input
                  type="number"
                  placeholder="0"
                  value={combinedAmounts[m.value]}
                  onChange={(e) => handleCombinedChange(m.value, e.target.value)}
                  className="flex-1"
                />
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-sm">
              <span>Итого введено:</span>
              <span
                className={
                  combinedTotal >= finalAmount
                    ? "font-medium text-green-600"
                    : "font-medium text-red-500"
                }
              >
                {formatMoney(combinedTotal)}
              </span>
            </div>
            {combinedTotal < finalAmount && (
              <p className="text-xs text-red-500">
                Не хватает: {formatMoney(finalAmount - combinedTotal)}
              </p>
            )}
          </div>
        ) : (
          /* Single method tabs */
          <Tabs
            value={activeMethod}
            onValueChange={(val) => setActiveMethod(val as PaymentMethodType)}
          >
            <TabsList className="w-full">
              {METHODS.map((m) => (
                <TabsTrigger key={m.value} value={m.value} className="flex-1 text-xs">
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="CASH" className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  Получено от покупателя
                </label>
                <Input
                  type="number"
                  placeholder={finalAmount.toString()}
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  autoFocus
                />
              </div>
              {cashReceived && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex justify-between text-sm">
                    <span>Сдача:</span>
                    <span
                      className={
                        change >= 0 ? "font-bold text-green-600" : "font-bold text-red-500"
                      }
                    >
                      {formatMoney(Math.max(0, change))}
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>

            {METHODS.filter((m) => m.value !== "CASH").map((m) => (
              <TabsContent key={m.value} value={m.value} className="mt-3">
                <div className="rounded-lg bg-muted p-4 text-center">
                  <div className="mb-2 flex justify-center">{m.icon}</div>
                  <p className="text-sm text-muted-foreground">
                    Оплата {m.label.toLowerCase()}: {formatMoney(finalAmount)}
                  </p>
                </div>
                {activeMethod === m.value && currentRate > 0 && (
                  <div className="mt-3 space-y-1 rounded-md bg-muted/50 p-3 transition-all duration-150">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Цена товара</span>
                      <span>{formatMoney(finalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-500">Комиссия банка</span>
                      <span className="text-orange-500">{formatMoney(singleFee)}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Итого к оплате</span>
                      <span>{formatMoney(singleTotalWithFee)}</span>
                    </div>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Comment */}
        <Textarea
          placeholder="Комментарий к продаже (необязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="resize-none"
        />

        {/* Confirm button */}
        <Button
          size="lg"
          className="w-full bg-green-600 text-white hover:bg-green-700"
          onClick={handleConfirm}
          disabled={loading || items.length === 0 || (isCombined && combinedTotal < finalAmount)}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Обработка...
            </>
          ) : (
            "Подтвердить оплату"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
