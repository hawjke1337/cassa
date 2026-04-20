"use client"

import React, { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import { createReceive, confirmReceive, searchAllProducts } from "@/actions/inventory"
import { ReceiveForm, type ReceiveFormItem } from "@/components/inventory/receive-form"
import { getSuppliersList } from "@/actions/suppliers"
import { useCurrentStore } from "@/hooks/use-current-store"
import { formatMoney } from "@/lib/format"
import { toast } from "sonner"
import { SerialEntryRows, type SerialEntry } from "@/components/serial/serial-entry-rows"

interface ReceiveItem {
  productId: string
  name: string
  sku: string
  quantity: number
  costPrice: number
  isSerialized: boolean
  identifierType: "IMEI" | "SN" | "BOTH" | null
  serialEntries: SerialEntry[]
  serialExpanded: boolean
}

interface ProductResult {
  id: string
  name: string
  sku: string
  barcode: string | null
  unit: string
  isSerialized: boolean
  identifierType: "IMEI" | "SN" | "BOTH" | null
}

interface SupplierOption {
  id: string
  name: string
}

export function NewReceiveClient() {
  const router = useRouter()
  const { currentStoreId } = useCurrentStore()
  const [isPending, startTransition] = useTransition()

  const [receiveId, setReceiveId] = useState<string | null>(null)
  const [sellPriceItems, setSellPriceItems] = useState<ReceiveFormItem[]>([])

  const [items, setItems] = useState<ReceiveItem[]>([])
  const [comment, setComment] = useState("")
  const [supplierId, setSupplierId] = useState<string>("")
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ProductResult[]>([])
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    getSuppliersList()
      .then(setSuppliers)
      .catch(() => {})
  }, [])

  async function handleSearch(query: string) {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    const results = await searchAllProducts(query)
    setSearchResults(results)
    setShowResults(true)
  }

  function addProduct(product: ProductResult) {
    if (items.find((i) => i.productId === product.id)) {
      toast.error("Товар уже добавлен")
      return
    }
    const initialEntries: SerialEntry[] = product.isSerialized
      ? [{ imei: null, imei2: null, serialNumber: null, costPrice: 0 }]
      : []
    setItems([
      ...items,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        costPrice: 0,
        isSerialized: product.isSerialized,
        identifierType: product.identifierType,
        serialEntries: initialEntries,
        serialExpanded: product.isSerialized,
      },
    ])
    setSearchQuery("")
    setSearchResults([])
    setShowResults(false)
  }

  function updateItem(index: number, field: "quantity" | "costPrice", value: number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const updated = { ...item, [field]: value }
        // For serialized items, sync costPrice to all entries when base costPrice changes
        if (field === "costPrice" && item.isSerialized) {
          updated.serialEntries = updated.serialEntries.map((e) => ({
            ...e,
            costPrice: value,
          }))
        }
        return updated
      }),
    )
  }

  const updateSerialEntries = useCallback((index: number, entries: SerialEntry[]) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, serialEntries: entries } : item)),
    )
  }, [])

  function toggleSerialExpanded(index: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, serialExpanded: !item.serialExpanded } : item,
      ),
    )
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Check if all serialized items have complete entries
  const hasIncompleteSerials = items.some((item) => {
    if (!item.isSerialized) return false
    if (item.serialEntries.length !== item.quantity) return true
    return item.serialEntries.some((entry) => {
      const needsImei = item.identifierType === "IMEI" || item.identifierType === "BOTH"
      const needsSn = item.identifierType === "SN" || item.identifierType === "BOTH"
      if (needsImei && !entry.imei) return true
      if (needsSn && !entry.serialNumber) return true
      return false
    })
  })

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.costPrice, 0)

  async function handleSave(andConfirm: boolean) {
    if (!currentStoreId) {
      toast.error("Выберите магазин")
      return
    }
    if (items.length === 0) {
      toast.error("Добавьте товары")
      return
    }

    startTransition(async () => {
      try {
        const result = await createReceive(currentStoreId, {
          supplierId: supplierId || undefined,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            costPrice: i.costPrice,
          })),
          comment: comment || undefined,
        })

        if (andConfirm) {
          // Show sell-price collection step before confirming
          setReceiveId(result.id)
          setSellPriceItems(
            items.map((i) => ({
              productId: i.productId,
              name: i.name,
              quantity: i.quantity,
              costPrice: i.costPrice,
              isNewProduct: true, // always collect — server ignores for existing products
            })),
          )
          // Do NOT call confirmReceive here — ReceiveForm's onConfirm will do it
        } else {
          toast.success(`Приход ${result.number} сохранён как черновик`)
          router.push("/inventory/receive")
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка создания прихода")
      }
    })
  }

  async function handleConfirmWithPrices(sellPrices: Record<string, number>) {
    if (!receiveId) return
    try {
      const serialData: Record<
        string,
        Array<{
          imei?: string | null
          imei2?: string | null
          serialNumber?: string | null
          costPrice: number
        }>
      > = {}
      for (const item of items) {
        if (item.isSerialized && item.serialEntries.length > 0) {
          serialData[item.productId] = item.serialEntries
        }
      }
      const hasSerial = Object.keys(serialData).length > 0
      await confirmReceive(receiveId, hasSerial ? serialData : undefined, sellPrices)
      toast.success("Приход подтверждён. Остатки обновлены.")
      router.push("/inventory/receive")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка подтверждения прихода")
    }
  }

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин
      </div>
    )
  }

  if (sellPriceItems.length > 0 && receiveId) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Укажите цены продажи для новых товаров</h2>
        <p className="text-sm text-muted-foreground">
          Для товаров, которых ещё нет на складе, укажите цену продажи. Это обязательно.
        </p>
        <ReceiveForm items={sellPriceItems} onConfirm={handleConfirmWithPrices} />
        <Button
          variant="ghost"
          onClick={() => {
            setReceiveId(null)
            setSellPriceItems([])
          }}
        >
          ← Назад к списку
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Supplier select */}
      <div className="max-w-md">
        <Label className="mb-2">Поставщик</Label>
        <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Выберите поставщика" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Без поставщика</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product search */}
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
                key={p.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={() => addProduct(p)}
              >
                <Plus className="size-4 text-muted-foreground" />
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">{p.sku}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Items table */}
      {items.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead>Артикул</TableHead>
                <TableHead className="w-[120px]">Кол-во</TableHead>
                <TableHead className="w-[150px]">Себестоимость</TableHead>
                <TableHead className="w-[120px]">Сумма</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <React.Fragment key={item.productId}>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        {item.isSerialized && (
                          <button
                            type="button"
                            onClick={() => toggleSerialExpanded(index)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {item.serialExpanded ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </button>
                        )}
                        <span>{item.name}</span>
                        {item.isSerialized && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({item.identifierType})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.sku}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", parseInt(e.target.value) || 1)
                        }
                        className="h-8 w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.costPrice}
                        onChange={(e) =>
                          updateItem(index, "costPrice", parseFloat(e.target.value) || 0)
                        }
                        className="h-8 w-28"
                      />
                    </TableCell>
                    <TableCell>{formatMoney(item.quantity * item.costPrice)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {item.isSerialized && item.serialExpanded && item.identifierType && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <SerialEntryRows
                          quantity={item.quantity}
                          identifierType={item.identifierType}
                          baseCostPrice={item.costPrice}
                          entries={item.serialEntries}
                          onEntriesChange={(entries) => updateSerialEntries(index, entries)}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold">
                  Итого:
                </TableCell>
                <TableCell className="font-semibold">{formatMoney(totalAmount)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Comment */}
      <div className="max-w-md">
        <Label className="mb-2">Комментарий</Label>
        <Textarea
          placeholder="Комментарий к приходу..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => handleSave(false)}
          disabled={isPending || items.length === 0}
        >
          Сохранить черновик
        </Button>
        <Button
          onClick={() => handleSave(true)}
          disabled={isPending || items.length === 0 || hasIncompleteSerials}
          title={hasIncompleteSerials ? "Заполните все серийные номера" : undefined}
        >
          Подтвердить приход
        </Button>
      </div>
    </div>
  )
}
