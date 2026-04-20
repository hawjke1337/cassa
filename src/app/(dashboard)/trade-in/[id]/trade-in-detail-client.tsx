"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  getTradeIn,
  updateTradeInStatus,
  linkTradeInToSale,
  createProductFromTradeIn,
  sendTradeInToRepair,
  deleteTradeIn,
} from "@/actions/trade-in"
import { getCategories } from "@/actions/catalog"
import { TRADE_IN_TYPE_LABELS, TRADE_IN_STATUS_LABELS } from "@/lib/validations/trade-in"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  ArrowLeft,
  Loader2,
  Printer,
  Package,
  Wrench,
  ShoppingCart,
  Link2,
  Trash2,
  Ban,
} from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_STOCK: "bg-green-100 text-green-800",
  IN_REPAIR: "bg-blue-100 text-blue-800",
  SOLD: "bg-gray-100 text-gray-800",
  WRITTEN_OFF: "bg-red-100 text-red-800",
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  TRANSFER: "Перевод",
  MIXED: "Смешанный",
}

interface Props {
  tradeInId: string
  canManage: boolean
  canDelete: boolean
}

export function TradeInDetailClient({ tradeInId, canManage, canDelete }: Props) {
  const router = useRouter()
  const [tradeIn, setTradeIn] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Link sale dialog
  const [linkSaleOpen, setLinkSaleOpen] = useState(false)
  const [saleNumber, setSaleNumber] = useState("")

  // Create product dialog
  const [createProductOpen, setCreateProductOpen] = useState(false)
  const [categoryId, setCategoryId] = useState("")
  const [sellPrice, setSellPrice] = useState("")
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  const loadTradeIn = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getTradeIn(tradeInId)
      setTradeIn(data)
    } catch (err) {
      toast.error("Ошибка загрузки")
    } finally {
      setLoading(false)
    }
  }, [tradeInId])

  useEffect(() => {
    loadTradeIn()
  }, [loadTradeIn])

  useEffect(() => {
    if (createProductOpen && categories.length === 0) {
      getCategories().then(setCategories)
    }
  }, [createProductOpen, categories.length])

  async function handleStatusChange(status: string) {
    startTransition(async () => {
      try {
        await updateTradeInStatus(tradeInId, status as any)
        toast.success("Статус обновлён")
        loadTradeIn()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка")
      }
    })
  }

  async function handleSendToRepair() {
    startTransition(async () => {
      try {
        const result = await sendTradeInToRepair(tradeInId)
        toast.success(`Ремонт №${result.number} создан`)
        loadTradeIn()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка")
      }
    })
  }

  async function handleLinkSale() {
    startTransition(async () => {
      try {
        await linkTradeInToSale(tradeInId, saleNumber)
        toast.success("Привязано к продаже")
        setLinkSaleOpen(false)
        setSaleNumber("")
        loadTradeIn()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка")
      }
    })
  }

  async function handleCreateProduct() {
    startTransition(async () => {
      try {
        const result = await createProductFromTradeIn(tradeInId, {
          categoryId,
          sellPrice: Number(sellPrice),
        })
        toast.success(`Товар "${result.name}" создан`)
        setCreateProductOpen(false)
        loadTradeIn()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка")
      }
    })
  }

  async function handleDelete() {
    startTransition(async () => {
      try {
        await deleteTradeIn(tradeInId)
        toast.success("Запись удалена")
        router.push("/trade-in")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка")
      }
    })
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!tradeIn) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Запись не найдена</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back link */}
      <Link
        href="/trade-in"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к списку
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Трейд-ин №{tradeIn.number}</h1>
        <Badge className={STATUS_COLORS[tradeIn.status]}>
          {TRADE_IN_STATUS_LABELS[tradeIn.status as keyof typeof TRADE_IN_STATUS_LABELS] ??
            tradeIn.status}
        </Badge>
        <Badge variant="outline">
          {TRADE_IN_TYPE_LABELS[tradeIn.type as keyof typeof TRADE_IN_TYPE_LABELS] ?? tradeIn.type}
        </Badge>
        <span className="text-sm text-muted-foreground ml-auto">
          {new Date(tradeIn.createdAt).toLocaleDateString("ru-RU")} · {tradeIn.storeName} ·{" "}
          {tradeIn.acceptedBy}
        </span>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — info cards */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Клиент</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">ФИО: </span>
                <span className="font-medium">{tradeIn.customer.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Телефон: </span>
                <span>{tradeIn.customer.phone}</span>
              </div>
              {(tradeIn.customer.passportSeries || tradeIn.customer.passportNumber) && (
                <div>
                  <span className="text-muted-foreground">Паспорт: </span>
                  <span>
                    {[tradeIn.customer.passportSeries, tradeIn.customer.passportNumber]
                      .filter(Boolean)
                      .join(" ")}
                  </span>
                </div>
              )}
              {tradeIn.customer.passportIssuedBy && (
                <div>
                  <span className="text-muted-foreground">Выдан: </span>
                  <span>{tradeIn.customer.passportIssuedBy}</span>
                  {tradeIn.customer.passportIssuedAt && (
                    <span>
                      {" "}
                      {new Date(tradeIn.customer.passportIssuedAt).toLocaleDateString("ru-RU")}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Device */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Устройство</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Тип: </span>
                <span>{tradeIn.deviceType}</span>
              </div>
              {tradeIn.deviceBrand && (
                <div>
                  <span className="text-muted-foreground">Бренд: </span>
                  <span>{tradeIn.deviceBrand}</span>
                </div>
              )}
              {tradeIn.deviceModel && (
                <div>
                  <span className="text-muted-foreground">Модель: </span>
                  <span>{tradeIn.deviceModel}</span>
                </div>
              )}
              {tradeIn.deviceImei && (
                <div>
                  <span className="text-muted-foreground">IMEI: </span>
                  <span className="font-mono">{tradeIn.deviceImei}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Состояние: </span>
                <span>{tradeIn.deviceCondition}</span>
              </div>
              {tradeIn.comment && (
                <div>
                  <span className="text-muted-foreground">Комментарий: </span>
                  <span>{tradeIn.comment}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Стоимость</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Оценочная стоимость: </span>
                <span>{tradeIn.estimatedPrice.toLocaleString("ru-RU")} ₽</span>
              </div>
              <div>
                <span className="text-muted-foreground">Согласованная цена: </span>
                <span className="font-semibold text-base">
                  {tradeIn.agreedPrice.toLocaleString("ru-RU")} ₽
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payout (only if exists) */}
          {tradeIn.payout && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Выплата</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Способ: </span>
                  <span>
                    {PAYMENT_METHOD_LABELS[tradeIn.payout.method] ?? tradeIn.payout.method}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Сумма: </span>
                  <span className="font-semibold">
                    {tradeIn.payout.amount.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right — actions */}
        <div className="space-y-4">
          {/* Status actions */}
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Действия</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tradeIn.status === "PENDING" && (
                  <>
                    <Button
                      className="w-full"
                      variant="default"
                      disabled={isPending}
                      onClick={() => handleStatusChange("IN_STOCK")}
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Package className="h-4 w-4 mr-2" />
                      )}
                      На склад
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={isPending}
                      onClick={handleSendToRepair}
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wrench className="h-4 w-4 mr-2" />
                      )}
                      На ремонт
                    </Button>
                  </>
                )}

                {tradeIn.status === "IN_STOCK" && (
                  <Button
                    className="w-full"
                    variant="default"
                    disabled={isPending || !!tradeIn.product}
                    onClick={() => setCreateProductOpen(true)}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Создать товар
                  </Button>
                )}

                {tradeIn.status === "IN_REPAIR" && (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => handleStatusChange("IN_STOCK")}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Package className="h-4 w-4 mr-2" />
                    )}
                    Вернуть на склад
                  </Button>
                )}

                {/* Write-off for any status */}
                {tradeIn.status !== "WRITTEN_OFF" && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button className="w-full" variant="outline" disabled={isPending}>
                          <Ban className="h-4 w-4 mr-2" />
                          Списать
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Списать трейд-ин?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Устройство будет помечено как списанное. Это действие нельзя отменить.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleStatusChange("WRITTEN_OFF")}>
                          Списать
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {/* Delete */}
                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button className="w-full" variant="destructive" disabled={isPending}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Запись трейд-ина №{tradeIn.number} будет удалена безвозвратно.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sale link (TRADE_IN type only) */}
          {tradeIn.type === "TRADE_IN" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Продажа</CardTitle>
              </CardHeader>
              <CardContent>
                {tradeIn.sale ? (
                  <Link
                    href={`/sales/${tradeIn.sale.id}`}
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Привязана к продаже №{tradeIn.sale.number}
                  </Link>
                ) : canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setLinkSaleOpen(true)}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Привязать к продаже
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Продажа не привязана</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Related entities */}
          {(tradeIn.product || tradeIn.repair) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Связанные объекты</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tradeIn.product && (
                  <Link
                    href={`/catalog/${tradeIn.product.id}`}
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Package className="h-4 w-4" />
                    Товар: {tradeIn.product.name}
                  </Link>
                )}
                {tradeIn.repair && (
                  <Link
                    href={`/repairs/${tradeIn.repair.id}`}
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Wrench className="h-4 w-4" />
                    Ремонт №{tradeIn.repair.number}
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* Print contract */}
          <Link href={`/print/trade-in-contract/${tradeInId}`} target="_blank">
            <Button variant="outline" className="w-full">
              <Printer className="h-4 w-4 mr-2" />
              Скачать договор
            </Button>
          </Link>
        </div>
      </div>

      {/* Link to sale dialog */}
      <Dialog open={linkSaleOpen} onOpenChange={setLinkSaleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Привязать к продаже</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sale-number">Номер продажи</Label>
              <Input
                id="sale-number"
                placeholder="Введите номер продажи"
                value={saleNumber}
                onChange={(e) => setSaleNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkSaleOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleLinkSale} disabled={isPending || !saleNumber.trim()}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Привязать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create product dialog */}
      <Dialog open={createProductOpen} onOpenChange={setCreateProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать товар из трейд-ина</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="category-id">Категория</Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                <SelectTrigger className="w-full" id="category-id">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sell-price">Цена продажи (₽)</Label>
              <Input
                id="sell-price"
                type="number"
                placeholder="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateProductOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleCreateProduct}
              disabled={isPending || !categoryId.trim() || !sellPrice}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Создать товар
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
