"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  getOrder,
  updateOrderStatus,
  addOrderPayment,
  addItemsToOrder,
  searchOrderProducts,
  payAndChangeStatus,
  linkSerialUnitToOrder,
  unlinkSerialUnitFromOrder,
  updateOrderItemImei,
  updateOrderCosts,
  updateOrderItem,
  cancelOrderWithDecision,
  type CancelPrepaymentAction,
} from "@/actions/orders"
import { calculateNetProfit } from "@/lib/order-utils"
import { cn } from "@/lib/utils"
import { formatMoney, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { fieldErrorClass } from "@/lib/form-validation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  Loader2,
  CreditCard,
  Package,
  Truck,
  PackageCheck,
  HandCoins,
  Ban,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Phone,
  Mail,
  Search,
  Printer,
  User as UserIcon,
  Link2,
  Unlink,
} from "lucide-react"
import { toast } from "sonner"
import { SerialUnitPicker } from "@/components/serial/serial-unit-picker"
import { DebtPaymentDialog } from "@/components/suppliers/debt-payment-dialog"
import { OrderTimeline } from "./order-timeline"
import { STATUS_LABELS, STATUS_COLORS, PAYMENT_METHOD_LABELS } from "./order-status"
import type { CustomOrderStatus, PaymentMethod } from "@/generated/prisma/client"

type OrderData = Awaited<ReturnType<typeof getOrder>>

interface OrderDetailProps {
  orderId: string
  canManage: boolean
  canSeeCosts: boolean
}

export function OrderDetail({ orderId, canManage, canSeeCosts }: OrderDetailProps) {
  const router = useRouter()
  const [order, setOrder] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const loadOrder = useCallback(async () => {
    try {
      const data = await getOrder(orderId)
      setOrder(data)
    } catch (err: any) {
      toast.error(err.message || "Ошибка загрузки заказа")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground">
        Заказ не найден
      </div>
    )
  }

  const status = order.status as CustomOrderStatus
  const remainingAmount = order.totalAmount - order.prepaidAmount

  function handleStatusChange(newStatus: CustomOrderStatus, comment?: string, extraData?: any) {
    startTransition(async () => {
      try {
        await updateOrderStatus(orderId, newStatus, comment, extraData)
        toast.success(`Статус изменён: ${STATUS_LABELS[newStatus]}`)
        await loadOrder()
      } catch (err: any) {
        toast.error(err.message || "Ошибка смены статуса")
      }
    })
  }

  function handlePayment(method: PaymentMethod, amount: number) {
    startTransition(async () => {
      try {
        await addOrderPayment(orderId, { method, amount })
        toast.success("Оплата принята")
        await loadOrder()
      } catch (err: any) {
        toast.error(err.message || "Ошибка оплаты")
      }
    })
  }

  function handlePayAndChangeStatus(
    method: PaymentMethod,
    amount: number,
    newStatus: CustomOrderStatus,
    comment?: string,
    discountAmount?: number,
  ) {
    startTransition(async () => {
      try {
        await payAndChangeStatus(orderId, { method, amount }, newStatus, comment, {
          discountAmount,
        })
        toast.success(`Оплата принята, статус: ${STATUS_LABELS[newStatus]}`)
        await loadOrder()
      } catch (err: any) {
        toast.error(err.message || "Ошибка")
      }
    })
  }

  function handleAddItems(
    items: Array<{
      productId?: string
      name: string
      quantity: number
      price: number
      costPrice?: number
    }>,
  ) {
    startTransition(async () => {
      try {
        await addItemsToOrder(orderId, items)
        toast.success("Товары добавлены")
        await loadOrder()
      } catch (err: any) {
        toast.error(err.message || "Ошибка добавления товаров")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/orders")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{order.number}</h1>
              <Badge variant="outline" className={STATUS_COLORS[status]}>
                {STATUS_LABELS[status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {order.sellerName} &middot; {order.storeName} &middot; {formatDate(order.createdAt)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(`/print/order/${orderId}`, "_blank")}
          >
            <Printer className="size-4" />
            Печать
          </Button>
          {order.saleId && (
            <Button
              variant="outline"
              onClick={() => window.open(`/print/sale/${order.saleId}`, "_blank")}
            >
              <Printer className="size-4" />
              Печать чека
            </Button>
          )}
          {canManage && (
            <OrderActions
              status={status}
              order={order}
              isPending={isPending}
              remainingAmount={remainingAmount}
              onStatusChange={handleStatusChange}
              onPayment={handlePayment}
              onPayAndChangeStatus={handlePayAndChangeStatus}
              onAddItems={handleAddItems}
              onCancelled={loadOrder}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Client info */}
          <Card>
            <CardHeader>
              <CardTitle>Клиент</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <UserIcon className="size-4 text-muted-foreground" />
                  <span>{order.clientName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" />
                  <a
                    href={`tel:${order.clientPhone}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {order.clientPhone}
                  </a>
                </div>
                {order.clientEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    <a
                      href={`mailto:${order.clientEmail}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {order.clientEmail}
                    </a>
                  </div>
                )}
              </div>
              {order.comment && (
                <div className="mt-3 rounded-lg bg-muted p-3 text-sm">{order.comment}</div>
              )}
            </CardContent>
          </Card>

          {/* Supplier info */}
          {(order.supplierCity || order.trackingInfo || order.estimatedDays) && (
            <Card>
              <CardHeader>
                <CardTitle>Информация о доставке</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-6 text-sm">
                  {order.supplierCity && (
                    <div>
                      <span className="text-muted-foreground">Город: </span>
                      {order.supplierCity}
                    </div>
                  )}
                  {order.estimatedDays && (
                    <div>
                      <span className="text-muted-foreground">Срок: </span>
                      {order.estimatedDays} дн.
                    </div>
                  )}
                  {order.trackingInfo && (
                    <div>
                      <span className="text-muted-foreground">Трек: </span>
                      {order.trackingInfo}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Supplier debt */}
          {order.debtId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Долг поставщику</span>
                  {order.debtIsPaid ? (
                    <Badge variant="default" className="bg-green-600">
                      Оплачен
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Не оплачен</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-mono font-bold">
                    {formatMoney(parseFloat(order.debtAmount!))}
                  </span>
                  {!order.debtIsPaid && canManage && (
                    <DebtPaymentDialog
                      debtId={order.debtId}
                      debtAmount={order.debtAmount!}
                      totalPaid={order.debtTotalPaid ?? "0"}
                      orderNumber={order.number}
                      onSuccess={loadOrder}
                    />
                  )}
                </div>
                {order.debtTotalPaid && parseFloat(order.debtTotalPaid) > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Оплачено:</span>
                    <span className="font-mono">
                      {formatMoney(parseFloat(order.debtTotalPaid))}
                    </span>
                  </div>
                )}
                {order.debtPaidAt && (
                  <p className="text-sm text-muted-foreground">
                    Закрыт: {formatDate(order.debtPaidAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Financial breakdown: 3 amounts (SUP-03) */}
          {canSeeCosts && (
            <Card>
              <CardHeader>
                <CardTitle>Финансы заказа</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Цена клиенту:</span>
                  <span className="font-mono font-bold">{formatMoney(order.totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Закуп:</span>
                  <span className="font-mono">
                    {order.purchasePrice !== null ? formatMoney(order.purchasePrice) : "---"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Прибыль:</span>
                  {order.purchasePrice !== null ? (
                    (() => {
                      const profit = calculateNetProfit(
                        order.totalAmount,
                        order.finalAmount ? order.totalAmount - order.finalAmount : 0,
                        order.purchasePrice,
                        order.deliveryCost,
                      )
                      return (
                        <span
                          className={cn(
                            "font-mono font-bold",
                            profit !== null && profit > 0
                              ? "text-green-500"
                              : profit !== null && profit < 0
                                ? "text-red-500"
                                : "",
                          )}
                        >
                          {profit !== null ? formatMoney(profit) : "---"}
                        </span>
                      )
                    })()
                  ) : (
                    <span className="text-muted-foreground">Не рассчитана</span>
                  )}
                </div>
                {order.deliveryCost !== null && order.deliveryCost > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Стоимость доставки:</span>
                    <span className="font-mono">{formatMoney(order.deliveryCost)}</span>
                  </div>
                )}
                {/* Cost entry button */}
                {order.purchasePrice === null && order.canManageCosts && (
                  <CostEntryDialog orderId={order.id} onSuccess={loadOrder} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Товары</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Наименование</TableHead>
                    <TableHead className="text-center w-20">Кол-во</TableHead>
                    <TableHead className="text-right w-28">Цена</TableHead>
                    {canSeeCosts && <TableHead className="text-right w-28">Себест.</TableHead>}
                    <TableHead className="text-right w-28">Итого</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {item.name}
                          {item.requiresImei && !item.isSerialized && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              IMEI
                            </Badge>
                          )}
                        </div>
                        {item.productSku && (
                          <div className="text-xs text-muted-foreground">{item.productSku}</div>
                        )}
                        {/* Catalog serialized products — link/unlink SerialUnit */}
                        {item.isSerialized && (
                          <div className="mt-1">
                            {item.serialUnit ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground">
                                  {[
                                    item.serialUnit.imei && `IMEI: ${item.serialUnit.imei}`,
                                    item.serialUnit.imei2 && `IMEI2: ${item.serialUnit.imei2}`,
                                    item.serialUnit.serialNumber &&
                                      `SN: ${item.serialUnit.serialNumber}`,
                                  ]
                                    .filter(Boolean)
                                    .join(" / ") || item.serialUnit.id}
                                </span>
                                {canManage && !["COMPLETED", "CANCELLED"].includes(status) && (
                                  <UnlinkSerialButton orderItemId={item.id} onSuccess={loadOrder} />
                                )}
                              </div>
                            ) : (
                              canManage &&
                              !["COMPLETED", "CANCELLED"].includes(status) &&
                              item.productId && (
                                <LinkSerialDialog
                                  orderItemId={item.id}
                                  productId={item.productId}
                                  storeId={order.storeId}
                                  onSuccess={loadOrder}
                                />
                              )
                            )}
                          </div>
                        )}
                        {/* Manual items with requiresImei — inline IMEI input */}
                        {item.requiresImei && !item.isSerialized && (
                          <div className="mt-1">
                            {item.imei ? (
                              <span className="text-xs font-mono text-muted-foreground">
                                IMEI: {item.imei}
                              </span>
                            ) : (
                              canManage &&
                              !["COMPLETED", "CANCELLED"].includes(status) && (
                                <ImeiInlineInput itemId={item.id} onSuccess={loadOrder} />
                              )
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(item.price)}
                      </TableCell>
                      {canSeeCosts && (
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {item.costPrice ? formatMoney(item.costPrice) : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono">
                        {formatMoney(item.price * item.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 space-y-1 text-right">
                <div className="text-sm text-muted-foreground">
                  Итого:{" "}
                  <span className="font-mono font-bold text-foreground">
                    {formatMoney(order.totalAmount)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Оплачено:{" "}
                  <span className="font-mono text-green-400">
                    {formatMoney(order.prepaidAmount)}
                  </span>
                </div>
                {remainingAmount > 0 && status !== "CANCELLED" && (
                  <div className="text-sm text-muted-foreground">
                    Остаток:{" "}
                    <span className="font-mono text-yellow-400">
                      {formatMoney(remainingAmount)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payments */}
          {order.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Оплаты</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Способ</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                      <TableHead>Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(p.amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(p.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Timeline */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>История</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline history={order.statusHistory} currentStatus={order.status} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---- Action Buttons based on status ----

interface OrderActionsProps {
  status: CustomOrderStatus
  order: OrderData
  isPending: boolean
  remainingAmount: number
  onStatusChange: (status: CustomOrderStatus, comment?: string, extraData?: any) => void
  onPayment: (method: PaymentMethod, amount: number) => void
  onPayAndChangeStatus: (
    method: PaymentMethod,
    amount: number,
    newStatus: CustomOrderStatus,
    comment?: string,
    discountAmount?: number,
  ) => void
  onAddItems: (
    items: Array<{
      productId?: string
      name: string
      quantity: number
      price: number
      costPrice?: number
    }>,
  ) => void
  onCancelled: () => void
}

function OrderActions({
  status,
  order,
  isPending,
  remainingAmount,
  onStatusChange,
  onPayment,
  onPayAndChangeStatus,
  onAddItems,
  onCancelled,
}: OrderActionsProps) {
  const actions: React.ReactNode[] = []

  // Check if any items require IMEI but don't have it yet
  const hasMissingImei = order.items.some(
    (item) => item.requiresImei && !item.imei && !item.serialUnitId,
  )

  if (status === "NEW") {
    actions.push(
      <PaymentDialog
        key="prepay"
        title="Принять предоплату"
        defaultAmount={order.totalAmount}
        isPending={isPending}
        onConfirm={(method, amount) => {
          onPayAndChangeStatus(method, amount, "PREPAID", "Предоплата принята")
        }}
      />,
    )
  }

  if (status === "PREPAID") {
    actions.push(
      <SupplierDialog
        key="supplier"
        isPending={isPending}
        initialCity={order.supplierCityFromRelation ?? ""}
        onConfirm={(data) => {
          onStatusChange("ORDERED", "Заказан у поставщика", data)
        }}
      />,
    )
  }

  if (status === "ORDERED") {
    actions.push(
      <Button
        key="transit"
        variant="outline"
        disabled={isPending}
        onClick={() => onStatusChange("IN_TRANSIT", "Отмечен в пути")}
      >
        <Truck className="size-4" />
        Отметить в пути
      </Button>,
    )
  }

  if (status === "IN_TRANSIT") {
    actions.push(
      <Button
        key="arrived"
        variant="outline"
        disabled={isPending}
        onClick={() => onStatusChange("ARRIVED", "Товар прибыл")}
      >
        <PackageCheck className="size-4" />
        Отметить прибытие
      </Button>,
    )
  }

  if (status === "ARRIVED") {
    actions.push(
      <AddItemsDialog
        key="add-items"
        storeId={order.storeId}
        isPending={isPending}
        onConfirm={onAddItems}
      />,
    )
    actions.push(
      <Button
        key="ready"
        disabled={isPending}
        onClick={() => onStatusChange("READY_FOR_PICKUP", "Готов к выдаче")}
      >
        <HandCoins className="size-4" />
        Готов к выдаче
      </Button>,
    )
  }

  if (status === "READY_FOR_PICKUP") {
    actions.push(
      <AddItemsDialog
        key="add-items-ready"
        storeId={order.storeId}
        isPending={isPending}
        onConfirm={onAddItems}
      />,
    )
    if (remainingAmount > 0) {
      actions.push(
        <FinalPaymentDialog
          key="final-pay"
          remainingAmount={remainingAmount}
          totalAmount={order.totalAmount}
          isPending={isPending}
          disabled={hasMissingImei}
          onConfirm={(method, amount, discountAmt) => {
            onPayAndChangeStatus(method, amount, "COMPLETED", "Заказ выдан клиенту", discountAmt)
          }}
        />,
      )
    } else {
      actions.push(
        <CompleteWithDiscountDialog
          key="complete"
          totalAmount={order.totalAmount}
          isPending={isPending}
          disabled={hasMissingImei}
          onConfirm={(discountAmt) => {
            onStatusChange("COMPLETED", "Заказ выдан клиенту", { discountAmount: discountAmt })
          }}
        />,
      )
    }
    {
      hasMissingImei &&
        actions.push(
          <span key="imei-warn" className="text-xs text-destructive self-center">
            Укажите IMEI для всех товаров
          </span>,
        )
    }
  }

  // Cancel always available for non-terminal statuses
  if (!["COMPLETED", "CANCELLED"].includes(status)) {
    actions.push(
      <CancelDialog
        key="cancel"
        orderId={order.id}
        prepaidAmount={order.prepaidAmount}
        isPending={isPending}
        onSuccess={onCancelled}
      />,
    )
  }

  return <>{actions}</>
}

// ---- Dialogs ----

function PaymentDialog({
  title,
  defaultAmount,
  isPending,
  onConfirm,
}: {
  title: string
  defaultAmount: number
  isPending: boolean
  onConfirm: (method: PaymentMethod, amount: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>("CASH")
  const [amount, setAmount] = useState(String(defaultAmount))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" disabled={isPending}>
            <CreditCard className="size-4" />
            {title}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Укажите способ и сумму оплаты</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Способ оплаты</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Наличные</SelectItem>
                <SelectItem value="CARD">Карта</SelectItem>
                <SelectItem value="SBP">СБП</SelectItem>
                <SelectItem value="TRANSFER">Перевод</SelectItem>
                <SelectItem value="CREDIT">Кредит</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Сумма</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => {
              const amt = parseFloat(amount)
              if (isNaN(amt) || amt <= 0) {
                toast.error("Введите корректную сумму")
                return
              }
              onConfirm(method, amt)
              setOpen(false)
            }}
          >
            Принять оплату
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FinalPaymentDialog({
  remainingAmount,
  totalAmount,
  isPending,
  disabled,
  onConfirm,
}: {
  remainingAmount: number
  totalAmount: number
  isPending: boolean
  disabled?: boolean
  onConfirm: (method: PaymentMethod, amount: number, discountAmount?: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>("CASH")
  const [amount, setAmount] = useState(String(remainingAmount))
  const [discount, setDiscount] = useState("0")

  // UX2-13: Warning при оплате меньше остатка.
  // Non-blocking — оператор может сознательно принять частичную оплату
  // (например, долг клиент погасит позже). Warning только подсвечивает
  // ситуацию, чтобы операторы не оформляли "выдачу" с underpay по ошибке.
  const amountNum = parseFloat(amount) || 0
  const discountNum = parseFloat(discount) || 0
  const effectiveRemaining = Math.max(0, remainingAmount - discountNum)
  const underpaid = amountNum > 0 && amountNum < effectiveRemaining
  const amountInvalid = amount !== "" && (isNaN(parseFloat(amount)) || amountNum <= 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            disabled={isPending || disabled}
            title={disabled ? "Укажите IMEI для всех товаров" : undefined}
          >
            <HandCoins className="size-4" />
            Выдать клиенту ({formatMoney(remainingAmount)} к оплате)
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Финальная оплата и выдача</DialogTitle>
          <DialogDescription>Остаток к оплате: {formatMoney(remainingAmount)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Способ оплаты</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Наличные</SelectItem>
                <SelectItem value="CARD">Карта</SelectItem>
                <SelectItem value="SBP">СБП</SelectItem>
                <SelectItem value="TRANSFER">Перевод</SelectItem>
                <SelectItem value="CREDIT">Кредит</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Сумма</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={fieldErrorClass(amountInvalid)}
            />
          </div>
          <div className="space-y-2">
            <Label>Скидка</Label>
            <Input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
              min={0}
              max={totalAmount}
            />
          </div>

          {/* UX2-13: Inline underpayment warning — не блокирует, но
              заставляет оператора осознанно нажать "Подтвердить". */}
          {underpaid && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Оплата меньше остатка</AlertTitle>
              <AlertDescription>
                Внесено {formatMoney(amountNum)} из {formatMoney(effectiveRemaining)}. После
                оформления клиент останется должен {formatMoney(effectiveRemaining - amountNum)}.
                Убедитесь, что клиент доплатит позже.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => {
              const amt = parseFloat(amount)
              if (isNaN(amt) || amt <= 0) {
                toast.error("Введите корректную сумму")
                return
              }
              const disc = parseFloat(discount) || 0
              if (disc < 0 || disc > totalAmount) {
                toast.error("Некорректная сумма скидки")
                return
              }
              onConfirm(method, amt, disc > 0 ? disc : undefined)
              setOpen(false)
            }}
          >
            Оплатить и выдать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SupplierDialog({
  isPending,
  initialCity,
  onConfirm,
}: {
  isPending: boolean
  initialCity?: string
  onConfirm: (data: {
    supplierCity?: string
    estimatedDays?: number
    trackingInfo?: string
  }) => void
}) {
  const [open, setOpen] = useState(false)
  const [city, setCity] = useState(initialCity ?? "")
  const [days, setDays] = useState("")
  const [tracking, setTracking] = useState("")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" disabled={isPending}>
            <Package className="size-4" />
            Заказать у поставщика
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Информация о заказе поставщику</DialogTitle>
          <DialogDescription>Укажите данные для отслеживания</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Город поставщика</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва" />
          </div>
          <div className="space-y-2">
            <Label>Ожидаемый срок (дней)</Label>
            <Input
              type="number"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="5"
            />
          </div>
          <div className="space-y-2">
            <Label>Трек-номер / информация</Label>
            <Input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Трек-номер или ссылка"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => {
              onConfirm({
                supplierCity: city.trim() || undefined,
                estimatedDays: days ? parseInt(days) : undefined,
                trackingInfo: tracking.trim() || undefined,
              })
              setOpen(false)
            }}
          >
            Подтвердить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddItemsDialog({
  storeId,
  isPending,
  onConfirm,
}: {
  storeId: string
  isPending: boolean
  onConfirm: (
    items: Array<{
      productId?: string
      name: string
      quantity: number
      price: number
    }>,
  ) => void
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<
    Array<{ productId?: string; name: string; quantity: number; price: number }>
  >([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<
    Awaited<ReturnType<typeof searchOrderProducts>>
  >([])
  const [manualName, setManualName] = useState("")
  const [manualPrice, setManualPrice] = useState("")

  async function handleSearch(query: string) {
    setSearchQuery(query)
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    try {
      const results = await searchOrderProducts(storeId, query)
      setSearchResults(results)
    } catch {
      // ignore
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setItems([])
          setSearchQuery("")
          setSearchResults([])
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" disabled={isPending}>
            <Plus className="size-4" />
            Добавить товары
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Добавить товары к заказу</DialogTitle>
          <DialogDescription>Аксессуары, чехлы, плёнки и т.д.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Поиск товара..."
              className="pl-8"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg border bg-popover">
              {searchResults.map((p) => (
                <button
                  key={p.productId}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => {
                    setItems([
                      ...items,
                      {
                        productId: p.productId,
                        name: p.name,
                        quantity: 1,
                        price: p.price,
                      },
                    ])
                    setSearchQuery("")
                    setSearchResults([])
                  }}
                >
                  <span>{p.name}</span>
                  <span className="font-mono">{formatMoney(p.price)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Manual */}
          <div className="flex gap-2">
            <Input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Название"
              className="flex-1"
            />
            <Input
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              placeholder="Цена"
              type="number"
              className="w-24"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (!manualName.trim() || !manualPrice) return
                setItems([
                  ...items,
                  {
                    name: manualName.trim(),
                    quantity: 1,
                    price: parseFloat(manualPrice),
                  },
                ])
                setManualName("")
                setManualPrice("")
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {/* Added items */}
          {items.length > 0 && (
            <div className="space-y-1">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded bg-muted px-3 py-1.5 text-sm"
                >
                  <span>{item.name}</span>
                  <span className="font-mono">{formatMoney(item.price)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={isPending || items.length === 0}
            onClick={() => {
              onConfirm(items)
              setOpen(false)
              setItems([])
            }}
          >
            Добавить ({items.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({
  orderId,
  prepaidAmount,
  isPending: parentPending,
  onSuccess,
}: {
  orderId: string
  prepaidAmount: number
  isPending: boolean
  onSuccess: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [prepaymentAction, setPrepaymentAction] = useState<CancelPrepaymentAction>("HOLD")
  const [isSubmitting, startSubmit] = useTransition()

  const hasPrepayment = prepaidAmount > 0
  const busy = parentPending || isSubmitting
  const canSubmit = reason.trim().length > 0 && !busy

  function resetState() {
    setReason("")
    setPrepaymentAction("HOLD")
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) resetState()
  }

  function handleSubmit() {
    if (!canSubmit) return
    const trimmedReason = reason.trim()
    const effectiveAction: CancelPrepaymentAction = hasPrepayment ? prepaymentAction : "HOLD"

    startSubmit(async () => {
      try {
        await cancelOrderWithDecision(orderId, {
          prepaymentAction: effectiveAction,
          reason: trimmedReason,
        })
        toast.success(
          hasPrepayment && effectiveAction === "REFUND"
            ? "Заказ отменён, предоплата возвращена клиенту"
            : "Заказ отменён",
        )
        setOpen(false)
        resetState()
        await onSuccess()
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ошибка отмены заказа"
        toast.error(message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            disabled={parentPending}
            className="text-destructive hover:text-destructive"
          >
            <Ban className="size-4" />
            Отменить
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Отмена заказа</DialogTitle>
          <DialogDescription>
            {hasPrepayment
              ? "Выберите, что сделать с предоплатой, и укажите причину отмены."
              : "Укажите причину отмены. Отмена безвозвратна."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {hasPrepayment && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Что сделать с предоплатой?</Label>
              <RadioGroup
                value={prepaymentAction}
                onValueChange={(value) => setPrepaymentAction(value as CancelPrepaymentAction)}
                className="grid gap-2"
              >
                <Label
                  htmlFor="cancel-prepayment-hold"
                  className={cn(
                    "group relative flex cursor-pointer items-start gap-3 rounded-lg border border-input bg-background p-4 transition-all",
                    "hover:border-emerald-400/60 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5",
                    "has-[[data-state=checked]]:border-emerald-500 has-[[data-state=checked]]:bg-emerald-50/60 has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-emerald-500/20",
                    "dark:has-[[data-state=checked]]:bg-emerald-500/10",
                  )}
                >
                  <RadioGroupItem id="cancel-prepayment-hold" value="HOLD" className="mt-0.5" />
                  <div className="flex flex-1 items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <HandCoins className="size-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold">Удержать предоплату</div>
                      <div className="text-xs text-muted-foreground">
                        Предоплата остаётся в кассе. Используйте, если клиент отказался без возврата
                        средств.
                      </div>
                    </div>
                  </div>
                </Label>

                <Label
                  htmlFor="cancel-prepayment-refund"
                  className={cn(
                    "group relative flex cursor-pointer items-start gap-3 rounded-lg border border-input bg-background p-4 transition-all",
                    "hover:border-destructive/60 hover:bg-destructive/5",
                    "has-[[data-state=checked]]:border-destructive has-[[data-state=checked]]:bg-destructive/5 has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-destructive/20",
                  )}
                >
                  <RadioGroupItem id="cancel-prepayment-refund" value="REFUND" className="mt-0.5" />
                  <div className="flex flex-1 items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                      <Ban className="size-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold">Вернуть клиенту</div>
                      <div className="text-xs text-muted-foreground">
                        Создаст возвратный платёж и расход в кассе на сумму предоплаты.
                      </div>
                    </div>
                  </div>
                </Label>
              </RadioGroup>

              {prepaymentAction === "REFUND" && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span className="leading-relaxed">
                    Требуется открытая смена. Возврат создаст расход в кассе.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cancel-reason" className="text-sm font-medium">
              Причина отмены <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Например: клиент передумал, товар не поступил, ошибка оператора..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
            Назад
          </Button>
          <Button variant="destructive" disabled={!canSubmit} onClick={handleSubmit}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Подтвердить отмену
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---- Serial Unit Link/Unlink ----

function LinkSerialDialog({
  orderItemId,
  productId,
  storeId,
  onSuccess,
}: {
  orderItemId: string
  productId: string
  storeId: string
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    if (selectedIds.length === 0) return
    startTransition(async () => {
      try {
        await linkSerialUnitToOrder(orderItemId, selectedIds[0])
        toast.success("Серийная единица привязана")
        setOpen(false)
        setSelectedIds([])
        onSuccess()
      } catch (err: any) {
        toast.error(err.message || "Ошибка привязки")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setSelectedIds([])
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
            <Link2 className="size-3" />
            Привязать IMEI
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Привязать серийную единицу</DialogTitle>
          <DialogDescription>
            Выберите IMEI / серийный номер из доступных на складе
          </DialogDescription>
        </DialogHeader>
        <SerialUnitPicker
          storeId={storeId}
          productId={productId}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          maxSelection={1}
        />
        <DialogFooter>
          <Button disabled={isPending || selectedIds.length === 0} onClick={handleConfirm}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Привязать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UnlinkSerialButton({
  orderItemId,
  onSuccess,
}: {
  orderItemId: string
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-5 px-1 text-xs text-muted-foreground hover:text-destructive"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            await unlinkSerialUnitFromOrder(orderItemId)
            toast.success("Привязка снята")
            onSuccess()
          } catch (err: any) {
            toast.error(err.message || "Ошибка")
          }
        })
      }}
    >
      {isPending ? <Loader2 className="size-3 animate-spin" /> : <Unlink className="size-3" />}
      Отвязать
    </Button>
  )
}

// ---- Inline IMEI Input for manual items ----

function ImeiInlineInput({ itemId, onSuccess }: { itemId: string; onSuccess: () => void }) {
  const [value, setValue] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!value.trim()) return
    startTransition(async () => {
      try {
        await updateOrderItemImei(itemId, value.trim())
        toast.success("IMEI сохранён")
        onSuccess()
      } catch (err: any) {
        toast.error(err.message || "Ошибка сохранения IMEI")
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Введите IMEI"
        className="h-7 w-44 text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave()
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={isPending || !value.trim()}
        onClick={handleSave}
      >
        {isPending ? <Loader2 className="size-3 animate-spin" /> : "OK"}
      </Button>
    </div>
  )
}

// ---- Cost Entry Dialog (ORD-02) ----

function CostEntryDialog({ orderId, onSuccess }: { orderId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [purchasePrice, setPurchasePrice] = useState("")
  const [deliveryCost, setDeliveryCost] = useState("")
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)

  const pp = parseFloat(purchasePrice) || 0
  const dc = parseFloat(deliveryCost) || 0

  function handleSubmit() {
    if (pp <= 0) {
      toast.error("Закупочная цена должна быть больше 0")
      return
    }
    setShowConfirm(true)
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        await updateOrderCosts(orderId, {
          purchasePrice: pp,
          deliveryCost: dc > 0 ? dc : undefined,
        })
        toast.success("Закупочные данные сохранены")
        setOpen(false)
        setShowConfirm(false)
        onSuccess()
      } catch (err: any) {
        toast.error(err.message || "Ошибка сохранения")
        setShowConfirm(false)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setShowConfirm(false)
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <CreditCard className="size-4" />
            Ввести закупочные данные
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Закупочные данные</DialogTitle>
          <DialogDescription>Введите закупочную цену и стоимость доставки</DialogDescription>
        </DialogHeader>
        {!showConfirm ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Закупочная цена *</Label>
                <Input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="0"
                  min={0}
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>Стоимость доставки</Label>
                <Input
                  type="number"
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(e.target.value)}
                  placeholder="0"
                  min={0}
                  step="0.01"
                />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={isPending || pp <= 0} onClick={handleSubmit}>
                Далее
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
              <div className="flex justify-between">
                <span>Закупочная:</span>
                <span className="font-mono font-bold">{formatMoney(pp)}</span>
              </div>
              {dc > 0 && (
                <div className="flex justify-between">
                  <span>Доставка:</span>
                  <span className="font-mono">{formatMoney(dc)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Итого долг:</span>
                <span className="font-mono font-bold">{formatMoney(pp + dc)}</span>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Назад
              </Button>
              <Button disabled={isPending} onClick={handleConfirm}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Подтвердить
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---- Complete with Discount Dialog (ORD-07) ----

function CompleteWithDiscountDialog({
  totalAmount,
  isPending,
  disabled,
  onConfirm,
}: {
  totalAmount: number
  isPending: boolean
  disabled?: boolean
  onConfirm: (discountAmount?: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [discount, setDiscount] = useState("0")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            disabled={isPending || disabled}
            title={disabled ? "Укажите IMEI для всех товаров" : undefined}
          >
            <HandCoins className="size-4" />
            Выдать клиенту
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Выдача заказа</DialogTitle>
          <DialogDescription>Сумма заказа: {formatMoney(totalAmount)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Скидка</Label>
            <Input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
              min={0}
              max={totalAmount}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => {
              const disc = parseFloat(discount) || 0
              if (disc < 0 || disc > totalAmount) {
                toast.error("Некорректная сумма скидки")
                return
              }
              onConfirm(disc > 0 ? disc : undefined)
              setOpen(false)
            }}
          >
            Выдать клиенту
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
