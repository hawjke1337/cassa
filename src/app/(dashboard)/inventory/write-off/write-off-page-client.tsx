"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Search, Plus, Trash2, ChevronLeft, ChevronRight, Printer } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createWriteOff,
  getWriteOffs,
  searchInventoryProducts,
} from "@/actions/inventory"
import { useCurrentStore } from "@/hooks/use-current-store"
import { formatDate } from "@/lib/format"
import { toast } from "sonner"
import { SerialUnitPicker } from "@/components/serial/serial-unit-picker"

interface WriteOffItem {
  productId: string
  name: string
  sku: string
  quantity: number
  maxStock: number
  isSerialized: boolean
  identifierType: string | null
  serialUnitIds: string[]
  writeOffReason?: string
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

interface WriteOffRow {
  id: string
  number: string
  reason: string
  itemCount: number
  createdByName: string
  createdAt: string
}

export function WriteOffPageClient() {
  const { currentStoreId } = useCurrentStore()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)

  // Form
  const [items, setItems] = useState<WriteOffItem[]>([])
  const [reason, setReason] = useState("")

  // Search
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ProductResult[]>([])
  const [showResults, setShowResults] = useState(false)

  // History
  const [writeOffs, setWriteOffs] = useState<WriteOffRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const loadWriteOffs = useCallback(async () => {
    if (!currentStoreId) return
    setIsLoading(true)
    startTransition(async () => {
      try {
        const result = await getWriteOffs(currentStoreId, { page, perPage: 20 })
        setWriteOffs(result.writeOffs)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      } finally {
        setIsLoading(false)
      }
    })
  }, [currentStoreId, page])

  useEffect(() => {
    loadWriteOffs()
  }, [loadWriteOffs])

  async function handleSearch(query: string) {
    setSearchQuery(query)
    if (!currentStoreId || query.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    const results = await searchInventoryProducts(currentStoreId, query)
    setSearchResults(results.filter((r) => r.stock > 0))
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

  function updateItemReason(index: number, writeOffReason: string) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, writeOffReason } : item
      )
    )
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!currentStoreId) {
      toast.error("Выберите магазин")
      return
    }
    if (!reason.trim()) {
      toast.error("Укажите причину списания")
      return
    }
    if (items.length === 0) {
      toast.error("Добавьте товары")
      return
    }

    // Validate serialized items have at least one unit selected
    const invalidSerial = items.find((i) => i.isSerialized && i.serialUnitIds.length === 0)
    if (invalidSerial) {
      toast.error(`Выберите серийные единицы для "${invalidSerial.name}"`)
      return
    }

    // Build submission array: each serial unit becomes a separate item
    const submitItems: Array<{
      productId: string
      quantity: number
      serialUnitId?: string
      writeOffReason?: string
    }> = []

    for (const item of items) {
      if (item.isSerialized) {
        for (const unitId of item.serialUnitIds) {
          submitItems.push({
            productId: item.productId,
            quantity: 1,
            serialUnitId: unitId,
            writeOffReason: item.writeOffReason || undefined,
          })
        }
      } else {
        submitItems.push({
          productId: item.productId,
          quantity: item.quantity,
        })
      }
    }

    startTransition(async () => {
      try {
        await createWriteOff(currentStoreId, submitItems, reason)
        toast.success("Списание проведено")
        setItems([])
        setReason("")
        loadWriteOffs()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка")
      }
    })
  }

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Write-off form */}
      <Card>
        <CardHeader>
          <CardTitle>Новое списание</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <Label className="mb-2">Причина списания *</Label>
            <Textarea
              placeholder="Укажите причину списания..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
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
                    {p.isSerialized && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        Серийный
                      </span>
                    )}
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
                    <TableHead className="w-[200px]">Кол-во / Единицы</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.productId} className="align-top">
                      <TableCell className="font-medium">
                        {item.name}
                        {item.isSerialized && (
                          <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            Серийный
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.sku}</TableCell>
                      <TableCell>{item.maxStock}</TableCell>
                      <TableCell>
                        {item.isSerialized ? (
                          <div className="space-y-2">
                            <SerialUnitPicker
                              storeId={currentStoreId}
                              productId={item.productId}
                              selectedIds={item.serialUnitIds}
                              onSelectionChange={(ids) => updateSerialSelection(index, ids)}
                            />
                            {item.serialUnitIds.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Выбрано: {item.serialUnitIds.length}
                              </p>
                            )}
                            <div>
                              <Input
                                placeholder="Причина (необязательно)"
                                value={item.writeOffReason || ""}
                                onChange={(e) => updateItemReason(index, e.target.value)}
                                className="h-7 text-xs"
                              />
                            </div>
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
            onClick={handleSubmit}
            disabled={isPending || items.length === 0 || !reason.trim()}
          >
            Провести списание
          </Button>
        </CardContent>
      </Card>

      {/* Write-off history */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">История списаний</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Номер</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Причина</TableHead>
                <TableHead>Позиций</TableHead>
                <TableHead>Кто списал</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : writeOffs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Нет списаний
                  </TableCell>
                </TableRow>
              ) : (
                writeOffs.map((wo) => (
                  <TableRow key={wo.id}>
                    <TableCell className="font-mono text-sm">{wo.number}</TableCell>
                    <TableCell>{formatDate(wo.createdAt)}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{wo.reason}</TableCell>
                    <TableCell>{wo.itemCount}</TableCell>
                    <TableCell>{wo.createdByName}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`/print/write-off/${wo.id}`, "_blank")}
                        title="Печать"
                      >
                        <Printer className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
