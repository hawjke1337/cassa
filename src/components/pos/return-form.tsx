"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
import { useCriticalToast } from "@/hooks/use-critical-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { searchSaleByNumber, searchSaleByImei, createReturn } from "@/actions/sales"
import { formatMoney, formatDate } from "@/lib/format"
import { toast } from "sonner"
import { Search, ArrowLeft, Loader2, Undo2 } from "lucide-react"
import Link from "next/link"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  SBP: "СБП",
  TRANSFER: "Перевод",
  CREDIT: "Рассрочка",
}

type RefundMethod = "CASH" | "CARD" | "SBP" | "TRANSFER" | "CREDIT"

function methodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method
}

type SaleData = NonNullable<Awaited<ReturnType<typeof searchSaleByNumber>>>

interface ReturnItemState {
  saleItemId: string
  selected: boolean
  quantity: number
  maxQuantity: number
}

export function ReturnForm() {
  const [searchMode, setSearchMode] = useState<"number" | "imei">("number")
  const [searchNumber, setSearchNumber] = useState("")
  const [searchImei, setSearchImei] = useState("")
  const [searching, setSearching] = useState(false)
  const [sale, setSale] = useState<SaleData | null>(null)
  const [returnItems, setReturnItems] = useState<ReturnItemState[]>([])
  const [reason, setReason] = useState("")
  // FIN-09: refundMethod обязательное; начинаем с пустой строки чтобы UI
  // мог подсветить required state когда оригинальные методы оплаты ещё не загружены.
  const [refundMethod, setRefundMethod] = useState<RefundMethod | "">("")
  const [submitting, setSubmitting] = useState(false)
  // UX2-01: Подтверждение возврата перед submit — финальная операция,
  // меняет Sale, деньги и остатки. AlertDialog с суммой + destructive
  // стилем кнопки. See handleInitiateReturn / handleSubmitReturn split.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const criticalToast = useCriticalToast()

  // FIN-09: Derive available refund methods из методов оплаты Sale.
  // Soft set policy: refundMethod ∈ set(sale.payments.methods).
  // Уникальный список preserves порядок появления в исходных payments.
  const availableMethods = useMemo<RefundMethod[]>(() => {
    if (!sale) return []
    const seen = new Set<string>()
    const result: RefundMethod[] = []
    for (const p of sale.payments) {
      if (!seen.has(p.method)) {
        seen.add(p.method)
        result.push(p.method as RefundMethod)
      }
    }
    return result
  }, [sale])

  // Auto-select когда метод оплаты единственный — уменьшает шанс ошибки оператора.
  useEffect(() => {
    if (availableMethods.length === 1) {
      setRefundMethod(availableMethods[0])
    } else if (availableMethods.length === 0) {
      setRefundMethod("")
    } else if (refundMethod && !availableMethods.includes(refundMethod as RefundMethod)) {
      // Если ранее выбранный метод исчез (новая Sale) — сбрасываем
      setRefundMethod("")
    }
  }, [availableMethods, refundMethod])

  const handleSearch = useCallback(async () => {
    if (!searchNumber.trim()) return

    setSearching(true)
    try {
      const result = await searchSaleByNumber(searchNumber.trim())
      if (!result) {
        toast.error("Продажа не найдена")
        setSale(null)
        setReturnItems([])
        return
      }

      setSale(result)
      setReturnItems(
        result.items.map((item) => {
          const available = item.quantity - item.returnedQuantity
          return {
            saleItemId: item.id,
            selected: false,
            quantity: available > 0 ? 1 : 0,
            maxQuantity: available,
          }
        }),
      )
      setReason("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка при поиске продажи")
    } finally {
      setSearching(false)
    }
  }, [searchNumber])

  const handleImeiSearch = useCallback(async () => {
    if (!searchImei.trim()) return
    setSearching(true)
    try {
      const result = await searchSaleByImei(searchImei.trim())
      if (!result) {
        toast.error("Продажа с этим IMEI не найдена")
        setSale(null)
        setReturnItems([])
        return
      }
      setSale(result)
      setReturnItems(
        result.items.map((item) => {
          const available = item.quantity - item.returnedQuantity
          return {
            saleItemId: item.id,
            selected: item.id === result.matchedSaleItemId && available > 0,
            quantity: available > 0 ? 1 : 0,
            maxQuantity: available,
          }
        }),
      )
      setReason("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка при поиске")
    } finally {
      setSearching(false)
    }
  }, [searchImei])

  function toggleItem(saleItemId: string) {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.saleItemId === saleItemId ? { ...item, selected: !item.selected } : item,
      ),
    )
  }

  function updateReturnQuantity(saleItemId: string, qty: number) {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.saleItemId === saleItemId
          ? { ...item, quantity: Math.max(1, Math.min(qty, item.maxQuantity)) }
          : item,
      ),
    )
  }

  // UX2-01: refundAmount вычисляется для отображения в AlertDialog.
  // Используем price - discount (net) × quantity по выбранным items
  // в порядке sale.items, чтобы цифра соответствовала фактическому Sale.
  const refundAmount = useMemo(() => {
    if (!sale) return 0
    let total = 0
    for (const state of returnItems) {
      if (!state.selected || state.quantity <= 0) continue
      const item = sale.items.find((i) => i.id === state.saleItemId)
      if (!item) continue
      const netPerUnit = item.price - item.discount
      total += netPerUnit * state.quantity
    }
    return total
  }, [sale, returnItems])

  /**
   * UX2-01: Первый этап — валидация + открытие AlertDialog.
   * Фактический createReturn зовётся из handleConfirmReturn только после
   * явного подтверждения оператором.
   */
  function handleInitiateReturn() {
    if (!sale) return

    const selectedCountLocal = returnItems.filter((i) => i.selected && i.quantity > 0).length
    if (selectedCountLocal === 0) {
      toast.error("Выберите товары для возврата")
      return
    }
    if (!reason.trim()) {
      toast.error("Укажите причину возврата")
      return
    }
    if (!refundMethod) {
      toast.error("Выберите метод возврата")
      return
    }
    if (!availableMethods.includes(refundMethod as RefundMethod)) {
      toast.error(`Метод возврата ${methodLabel(refundMethod)} недоступен для этой продажи`)
      return
    }

    setConfirmOpen(true)
  }

  async function handleConfirmReturn() {
    if (!sale) return

    const selectedItems = returnItems
      .filter((item) => item.selected && item.quantity > 0)
      .map((item) => ({
        saleItemId: item.saleItemId,
        quantity: item.quantity,
      }))

    // Guard — в теории покрыто handleInitiateReturn, но на случай гонки
    // двойного открытия диалога (UX2-02 тот же паттерн ref-lock тут
    // не критичен, submitting disabled справляется).
    if (selectedItems.length === 0 || !reason.trim() || !refundMethod) {
      setConfirmOpen(false)
      return
    }

    setConfirmOpen(false)
    setSubmitting(true)
    try {
      const result = await createReturn({
        saleId: sale.id,
        items: selectedItems,
        reason: reason.trim(),
        refundMethod: refundMethod as RefundMethod,
      })

      toast.success(`Возврат ${result.number} оформлен на сумму ${formatMoney(result.amount)}`)

      // Reset form
      setSale(null)
      setReturnItems([])
      setReason("")
      setRefundMethod("")
      setSearchNumber("")
      setSearchImei("")
    } catch (err) {
      // UX2-05: Возврат — критичная операция, показываем retry toast.
      criticalToast.error("Ошибка при оформлении возврата", {
        description: err instanceof Error ? err.message : undefined,
        retry: handleConfirmReturn,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCount = returnItems.filter((i) => i.selected).length

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/pos">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Оформление возврата</h1>
      </div>

      {/* Search */}
      <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as "number" | "imei")}>
        <TabsList className="mb-2">
          <TabsTrigger value="number">По номеру чека</TabsTrigger>
          <TabsTrigger value="imei">По IMEI / SN</TabsTrigger>
        </TabsList>
        <TabsContent value="number">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Номер продажи (например, S-2026-000001)"
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch()
                }}
                className="pl-9"
                autoFocus
              />
            </div>
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : "Найти"}
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="imei">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="IMEI или серийный номер"
                value={searchImei}
                onChange={(e) => setSearchImei(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleImeiSearch()
                }}
                className="pl-9"
              />
            </div>
            <Button onClick={handleImeiSearch} disabled={searching}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : "Найти"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Searching skeleton */}
      {searching && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      )}

      {/* Sale details */}
      {sale && !searching && (
        <div className="space-y-4">
          {/* Sale info card */}
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">Продажа {sale.number}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatDate(sale.createdAt)} | Продавец: {sale.sellerName}
                </p>
                <p className="text-sm text-muted-foreground">{sale.storeName}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatMoney(sale.finalAmount)}</p>
                <Badge
                  variant={
                    sale.status === "COMPLETED"
                      ? "secondary"
                      : sale.status === "RETURNED"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {sale.status === "COMPLETED"
                    ? "Завершена"
                    : sale.status === "RETURNED"
                      ? "Возвращена"
                      : "Частично возвращена"}
                </Badge>
              </div>
            </div>

            {/* Payment methods */}
            <div className="mt-2 flex gap-2">
              {sale.payments.map((p) => (
                <Badge key={p.id} variant="outline" className="text-xs">
                  {PAYMENT_METHOD_LABELS[p.method] || p.method}: {formatMoney(p.amount)}
                </Badge>
              ))}
            </div>
          </div>

          {/* Items for return */}
          {sale.status === "RETURNED" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
              Продажа полностью возвращена
            </div>
          ) : (
            <>
              <div className="rounded-lg border">
                <div className="border-b px-4 py-2">
                  <h4 className="text-sm font-medium">Товары для возврата</h4>
                </div>
                <div className="divide-y">
                  {sale.items.map((item) => {
                    const returnState = returnItems.find((ri) => ri.saleItemId === item.id)
                    const isFullyReturned = item.returnedQuantity >= item.quantity
                    const available = item.quantity - item.returnedQuantity

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 ${
                          isFullyReturned ? "opacity-40" : ""
                        }`}
                      >
                        <Checkbox
                          checked={returnState?.selected ?? false}
                          onCheckedChange={() => toggleItem(item.id)}
                          disabled={isFullyReturned}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.productSku} | Цена: {formatMoney(item.price)}
                            {item.discount > 0 && <> | Скидка: {formatMoney(item.discount)}</>}
                          </p>
                          {item.imei && (
                            <p className="text-xs font-mono text-blue-500">
                              IMEI: {item.imei}
                              {item.imei2 && ` / ${item.imei2}`}
                            </p>
                          )}
                          {!item.imei && item.serialNumber && (
                            <p className="text-xs font-mono text-blue-500">
                              SN: {item.serialNumber}
                            </p>
                          )}
                          {item.returnedQuantity > 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              Возвращено ранее: {item.returnedQuantity} шт
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">из {available} шт</span>
                          <Input
                            type="number"
                            min={1}
                            max={available}
                            value={returnState?.quantity ?? 0}
                            onChange={(e) => updateReturnQuantity(item.id, Number(e.target.value))}
                            disabled={isFullyReturned || !returnState?.selected}
                            className="h-7 w-16 text-center text-sm"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Refund method — FIN-09: только методы из оригинальной оплаты Sale */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Метод возврата <span className="text-red-500">*</span>
                </label>
                <Select
                  value={refundMethod}
                  onValueChange={(val) => val && setRefundMethod(val as RefundMethod)}
                  disabled={availableMethods.length === 0}
                >
                  <SelectTrigger
                    className={
                      !refundMethod
                        ? "border-amber-300 ring-1 ring-amber-200 dark:border-amber-700 dark:ring-amber-900"
                        : ""
                    }
                  >
                    <SelectValue
                      placeholder={
                        availableMethods.length === 1
                          ? methodLabel(availableMethods[0])
                          : "Выберите метод возврата"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {methodLabel(method)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Доступны только методы из оригинальной оплаты:{" "}
                  {availableMethods.map(methodLabel).join(", ") || "—"}
                </p>
              </div>

              {/* Reason */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Причина возврата <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="Укажите причину возврата..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              <Separator />

              {/* Submit */}
              <Button
                size="lg"
                className="w-full"
                onClick={handleInitiateReturn}
                disabled={submitting || selectedCount === 0 || !reason.trim() || !refundMethod}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Оформление...
                  </>
                ) : (
                  <>
                    <Undo2 className="mr-2 size-4" />
                    Оформить возврат ({selectedCount}{" "}
                    {selectedCount === 1 ? "товар" : selectedCount < 5 ? "товара" : "товаров"})
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      )}

      {/* UX2-01: Подтверждение возврата с суммой. Destructive кнопка —
          возврат меняет денежный и товарный учёт, нужна страховка от случайного клика. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердите возврат</AlertDialogTitle>
            <AlertDialogDescription>
              Будет оформлен возврат на сумму <b>{formatMoney(refundAmount)}</b>. Метод возврата:{" "}
              {methodLabel(refundMethod || "")}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleConfirmReturn}
            >
              Подтвердить возврат
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
