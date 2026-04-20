"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Search, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getTransfers,
  createTransfer,
  confirmTransferSent,
  confirmTransferReceived,
  cancelTransfer,
  searchInventoryProducts,
  getStoresForTransfer,
} from "@/actions/inventory"
import { SerialUnitPicker } from "@/components/serial/serial-unit-picker"
import { useCurrentStore } from "@/hooks/use-current-store"
import { formatDate } from "@/lib/format"
import { toast } from "sonner"

interface TransferRow {
  id: string
  number: string
  status: string
  fromStoreName: string
  toStoreName: string
  fromStoreId: string
  toStoreId: string
  itemCount: number
  createdByName: string
  createdAt: string
  confirmedAt: string | null
}

interface TransferItem {
  productId: string
  name: string
  sku: string
  quantity: number
  maxStock: number
  isSerialized: boolean
  identifierType: string | null
  serialUnitIds: string[]
}

interface ProductResult {
  productId: string
  name: string
  sku: string
  barcode: string | null
  unit: string
  stock: number
  costPrice: number
  sellPrice: number
  isSerialized: boolean
  identifierType: string | null
}

export function TransferPageClient() {
  const { currentStoreId } = useCurrentStore()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)

  // Transfer list
  const [transfers, setTransfers] = useState<TransferRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // New transfer form
  const [toStoreId, setToStoreId] = useState<string>("")
  const [items, setItems] = useState<TransferItem[]>([])
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([])

  // Product search
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ProductResult[]>([])
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    getStoresForTransfer().then(setStores)
  }, [])

  const loadTransfers = useCallback(async () => {
    if (!currentStoreId) return
    setIsLoading(true)
    startTransition(async () => {
      try {
        const result = await getTransfers(currentStoreId, { page, perPage: 20 })
        setTransfers(result.transfers)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      } finally {
        setIsLoading(false)
      }
    })
  }, [currentStoreId, page])

  useEffect(() => {
    loadTransfers()
  }, [loadTransfers])

  async function handleSearch(query: string) {
    setSearchQuery(query)
    if (!currentStoreId || query.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    const results = await searchInventoryProducts(currentStoreId, query)
    setSearchResults(results)
    setShowResults(true)
  }

  function addProduct(product: ProductResult) {
    if (items.find((i) => i.productId === product.productId)) {
      toast.error("Товар уже добавлен")
      return
    }
    setItems([
      ...items,
      {
        productId: product.productId,
        name: product.name,
        sku: product.sku,
        quantity: product.isSerialized ? 0 : 1,
        maxStock: product.stock,
        isSerialized: product.isSerialized,
        identifierType: product.identifierType,
        serialUnitIds: [],
      },
    ])
    setSearchQuery("")
    setSearchResults([])
    setShowResults(false)
  }

  function updateQuantity(index: number, quantity: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.min(quantity, item.maxStock) } : item
      )
    )
  }

  function updateSerialSelection(index: number, ids: string[]) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, serialUnitIds: ids, quantity: ids.length } : item
      )
    )
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleCreate() {
    if (!currentStoreId || !toStoreId) {
      toast.error("Выберите магазин назначения")
      return
    }
    if (items.length === 0) {
      toast.error("Добавьте товары")
      return
    }

    const hasEmptyItems = items.some((i) =>
      i.isSerialized ? i.serialUnitIds.length === 0 : i.quantity <= 0
    )
    if (hasEmptyItems) {
      toast.error("Выберите единицы для всех сериализованных товаров")
      return
    }

    startTransition(async () => {
      try {
        const result = await createTransfer(
          currentStoreId,
          toStoreId,
          items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            ...(i.isSerialized && i.serialUnitIds.length > 0
              ? { serialUnitIds: i.serialUnitIds }
              : {}),
          }))
        )
        toast.success(`Перемещение ${result.number} создано`)
        setItems([])
        setToStoreId("")
        loadTransfers()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка")
      }
    })
  }

  async function handleAction(
    action: "send" | "receive" | "cancel",
    transferId: string
  ) {
    try {
      if (action === "send") {
        await confirmTransferSent(transferId)
        toast.success("Товар отправлен")
      } else if (action === "receive") {
        await confirmTransferReceived(transferId)
        toast.success("Товар получен. Остатки обновлены.")
      } else {
        await cancelTransfer(transferId)
        toast.success("Перемещение отменено")
      }
      loadTransfers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка")
    }
  }

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин
      </div>
    )
  }

  function statusBadge(status: string) {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline">Ожидает</Badge>
      case "IN_TRANSIT":
        return <Badge variant="secondary">В пути</Badge>
      case "RECEIVED":
        return <Badge variant="default" className="bg-green-600">Получено</Badge>
      case "CANCELLED":
        return <Badge variant="destructive">Отменено</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const otherStores = stores.filter((s) => s.id !== currentStoreId)

  return (
    <div className="space-y-6">
      {/* New transfer form */}
      <Card>
        <CardHeader>
          <CardTitle>Новое перемещение</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <Label className="mb-2">Магазин назначения</Label>
            <Select value={toStoreId} onValueChange={(val) => setToStoreId(val ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите магазин" />
              </SelectTrigger>
              <SelectContent>
                {otherStores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative max-w-md">
            <Label className="mb-2">Добавить товар</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию, артикулу..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                className="pl-8"
              />
            </div>
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border bg-popover shadow-lg">
                {searchResults.map((p) => (
                  <button
                    key={p.productId}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    onMouseDown={() => addProduct(p)}
                  >
                    <Plus className="size-4 text-muted-foreground" />
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{p.sku}</span>
                    <span className="ml-auto text-muted-foreground">
                      Остаток: {p.stock}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead>Артикул</TableHead>
                    <TableHead>На складе</TableHead>
                    <TableHead className="w-[120px]">Кол-во</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.sku}</TableCell>
                      <TableCell>{item.maxStock}</TableCell>
                      <TableCell>
                        {item.isSerialized && currentStoreId ? (
                          <div>
                            <SerialUnitPicker
                              storeId={currentStoreId}
                              productId={item.productId}
                              selectedIds={item.serialUnitIds}
                              onSelectionChange={(ids) => updateSerialSelection(index, ids)}
                            />
                            <span className="text-xs text-muted-foreground">
                              Выбрано: {item.serialUnitIds.length}
                            </span>
                          </div>
                        ) : (
                          <Input
                            type="number"
                            min={1}
                            max={item.maxStock}
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(index, parseInt(e.target.value) || 1)
                            }
                            className="h-8 w-20"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Button
            onClick={handleCreate}
            disabled={isPending || items.length === 0 || !toStoreId}
          >
            Создать перемещение
          </Button>
        </CardContent>
      </Card>

      {/* Transfer history */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Номер</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Откуда</TableHead>
              <TableHead>Куда</TableHead>
              <TableHead>Позиций</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : transfers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Нет перемещений
                </TableCell>
              </TableRow>
            ) : (
              transfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-sm">{t.number}</TableCell>
                  <TableCell>{formatDate(t.createdAt)}</TableCell>
                  <TableCell>{t.fromStoreName}</TableCell>
                  <TableCell>{t.toStoreName}</TableCell>
                  <TableCell>{t.itemCount}</TableCell>
                  <TableCell>{statusBadge(t.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {t.status === "PENDING" &&
                        t.fromStoreId === currentStoreId && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction("send", t.id)}
                            >
                              Отправить
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction("cancel", t.id)}
                            >
                              Отменить
                            </Button>
                          </>
                        )}
                      {t.status === "IN_TRANSIT" &&
                        t.toStoreId === currentStoreId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction("receive", t.id)}
                          >
                            Принять
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Всего: {total}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isPending}
            >
              <ChevronLeft className="size-4" />
              Назад
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isPending}
            >
              Далее
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
