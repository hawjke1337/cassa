"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Search, Printer, Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { getTemplatesForPrint } from "@/actions/price-labels"
import { getProducts } from "@/actions/catalog"
import { useCurrentStore } from "@/hooks/use-current-store"
import type { PrintLabelsData } from "@/lib/validations/price-labels"

interface PrintItem {
  productId: string
  name: string
  sku: string
  quantity: number
}

interface PrintLabelsDialogProps {
  trigger: React.ReactNode
  preselectedProducts?: Array<{ id: string; name: string; sku: string }>
}

export function PrintLabelsDialog({
  trigger,
  preselectedProducts,
}: PrintLabelsDialogProps) {
  const { currentStoreId } = useCurrentStore()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const [templates, setTemplates] = useState<Array<{
    id: string; name: string; width: number; height: number; isDefault: boolean
  }>>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [items, setItems] = useState<PrintItem[]>([])
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{
    id: string; name: string; sku: string
  }>>([])

  useEffect(() => {
    if (!open || !currentStoreId) return
    startTransition(async () => {
      const result = await getTemplatesForPrint(currentStoreId)
      setTemplates(result)
      const defaultTemplate = result.find((t) => t.isDefault)
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id)
      } else if (result.length > 0) {
        setSelectedTemplateId(result[0].id)
      }
    })
  }, [open, currentStoreId])

  useEffect(() => {
    if (open && preselectedProducts) {
      setItems(
        preselectedProducts.map((p) => ({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          quantity: 1,
        }))
      )
    }
  }, [open, preselectedProducts])

  const handleSearch = useCallback(() => {
    if (!search || !currentStoreId) {
      setSearchResults([])
      return
    }
    startTransition(async () => {
      const result = await getProducts(currentStoreId, { search, perPage: 10 })
      setSearchResults(
        result.products
          .filter((p) => !items.some((i) => i.productId === p.id))
          .map((p) => ({ id: p.id, name: p.name, sku: p.sku }))
      )
    })
  }, [search, currentStoreId, items])

  useEffect(() => {
    const timer = setTimeout(handleSearch, 300)
    return () => clearTimeout(timer)
  }, [handleSearch])

  function addProduct(product: { id: string; name: string; sku: string }) {
    setItems((prev) => [...prev, { productId: product.id, name: product.name, sku: product.sku, quantity: 1 }])
    setSearch("")
    setSearchResults([])
  }

  function updateQuantity(productId: string, delta: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.max(1, i.quantity + delta) }
          : i
      )
    )
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  function handlePrint() {
    if (!selectedTemplateId || items.length === 0) return

    const data: PrintLabelsData = {
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    }
    localStorage.setItem("printLabelsData", JSON.stringify(data))
    window.open(`/print/price-labels?templateId=${selectedTemplateId}`, "_blank")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Печать ценников</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Шаблон</label>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет шаблонов. Создайте шаблон в настройках.</p>
            ) : (
              <Select value={selectedTemplateId} onValueChange={(val) => setSelectedTemplateId(val ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите шаблон" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.width}x{t.height} мм)
                      {t.isDefault ? " ★" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Product search */}
          {!preselectedProducts && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Добавить товар</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск по названию или артикулу..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => addProduct(p)}
                    >
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected products */}
          {items.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Товары ({items.length})</label>
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.sku}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => updateQuantity(item.productId, -1)}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => updateQuantity(item.productId, 1)}
                      >
                        <Plus className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive"
                        onClick={() => removeItem(item.productId)}
                      >
                        x
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Print button */}
          <Button
            className="w-full"
            disabled={!selectedTemplateId || items.length === 0 || templates.length === 0}
            onClick={handlePrint}
          >
            <Printer className="size-4" />
            Печать ({items.reduce((sum, i) => sum + i.quantity, 0)} шт.)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
