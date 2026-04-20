"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useCart } from "@/hooks/use-cart"
import { useCurrentStore } from "@/hooks/use-current-store"
import { searchPosProducts, searchByImeiForPos } from "@/actions/sales"
import { formatMoney } from "@/lib/format"
import { isValidEAN13 } from "@/lib/barcode"
import { toast } from "sonner"
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package,
  Percent,
  Smartphone,
  History,
} from "lucide-react"
import { PaymentDialog } from "./payment-dialog"
import { ShiftBanner } from "./shift-banner"
import { SalesHistory } from "./sales-history"
import { CategoryGrid, type CategoryGridItem } from "./category-grid"
import { SerialUnitPicker } from "@/components/serial/serial-unit-picker"
import { getCurrentShift } from "@/actions/shifts"
import { getCategories } from "@/actions/catalog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

type PosProduct = Awaited<ReturnType<typeof searchPosProducts>>[number]

export function PosInterface() {
  const { currentStoreId, currentStoreName } = useCurrentStore()
  const {
    items,
    addItem,
    removeItem,
    updateQuantity,
    applyDiscount,
    clearCart,
    getTotal,
    getDiscountTotal,
    getItemCount,
  } = useCart()

  const [search, setSearch] = useState("")
  const [products, setProducts] = useState<PosProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [editingDiscountKey, setEditingDiscountKey] = useState<string | null>(null)
  const [serialPickerProduct, setSerialPickerProduct] = useState<PosProduct | null>(null)
  const [selectedSerialIds, setSelectedSerialIds] = useState<string[]>([])
  const [loadedSerialUnits, setLoadedSerialUnits] = useState<
    Array<{ id: string; imei: string | null; imei2: string | null; serialNumber: string | null }>
  >([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryGridItem[]>([])
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const total = getTotal()
  const discount = getDiscountTotal()
  const finalAmount = total - discount
  const itemCount = getItemCount()

  // Load current shift for sales history
  useEffect(() => {
    if (!currentStoreId) {
      setCurrentShiftId(null)
      return
    }
    getCurrentShift(currentStoreId)
      .then((shift) => setCurrentShiftId(shift?.id ?? null))
      .catch(() => setCurrentShiftId(null))
  }, [currentStoreId])

  // UX2-17: Загрузить категории для CategoryGrid (показывается при пустом поиске)
  useEffect(() => {
    let cancelled = false
    getCategories()
      .then((list) => {
        if (cancelled) return
        setCategories(list.map((c) => ({ id: c.id, name: c.name, productCount: c.productCount })))
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // UX2-17: Загрузка товаров выбранной категории (пустой поиск + selectedCategoryId)
  useEffect(() => {
    if (!selectedCategoryId || !currentStoreId || search.trim()) return
    setSearching(true)
    searchPosProducts(currentStoreId, "", selectedCategoryId)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setSearching(false))
  }, [selectedCategoryId, currentStoreId, search])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!search.trim() && !selectedCategoryId) {
      if (!search.trim()) {
        setProducts([])
      }
      setSearching(false)
      return
    }

    if (!search.trim() || !currentStoreId) {
      // При активной категории — не триггерим debounced search; обработкой занимается
      // отдельный useEffect по selectedCategoryId.
      setSearching(false)
      return
    }

    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        // Check if search looks like EAN-13 barcode (13 digits)
        const trimmed = search.trim()
        if (/^\d{13}$/.test(trimmed) && isValidEAN13(trimmed)) {
          const barcodeResults = await searchPosProducts(currentStoreId, trimmed)
          const exactMatch = barcodeResults.find((p) => p.barcode === trimmed)
          if (exactMatch) {
            handleAddProduct(exactMatch)
            setSearch("")
            setProducts([])
            toast.success(`${exactMatch.name} добавлен по штрихкоду`)
            setSearching(false)
            return
          }
        }

        // Check if search looks like IMEI/serial (15 digits)
        if (/^\d{15}$/.test(search.trim())) {
          const imeiResult = await searchByImeiForPos(currentStoreId, search.trim())
          if (imeiResult) {
            addItem({
              productId: imeiResult.productId,
              name: imeiResult.name,
              sku: imeiResult.sku ?? "",
              price: imeiResult.price,
              costPrice: imeiResult.costPrice,
              maxStock: 1,
              serialUnitId: imeiResult.serialUnitId,
              imei: imeiResult.imei ?? imeiResult.serialNumber ?? null,
            })
            setSearch("")
            setProducts([])
            toast.success(`${imeiResult.name} добавлен по IMEI`)
            setSearching(false)
            return
          }
        }

        const results = await searchPosProducts(currentStoreId, search.trim())
        setProducts(results)
      } catch (err) {
        toast.error("Ошибка поиска товаров")
        setProducts([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [search, currentStoreId])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === "F2") {
        e.preventDefault()
        if (items.length > 0) {
          setPaymentOpen(true)
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        // Guard: do not clear cart if a dialog is open
        if (paymentOpen || serialPickerProduct || clearConfirmOpen) return
        if (items.length > 0) {
          setClearConfirmOpen(true)
        }
      }
    },
    [items.length, paymentOpen, serialPickerProduct, clearConfirmOpen],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  function handleAddProduct(product: PosProduct) {
    if (product.isSerialized) {
      // Open serial picker dialog
      setSerialPickerProduct(product)
      setSelectedSerialIds([])
      setLoadedSerialUnits([])
      return
    }
    addItem({
      productId: product.productId,
      name: product.name,
      sku: product.sku ?? "",
      price: product.price,
      costPrice: product.costPrice,
      maxStock: product.maxStock,
    })
  }

  function handleSerialPickerConfirm() {
    if (!serialPickerProduct || !currentStoreId) return
    // Each selected serial unit becomes a separate cart line
    const unitMap = new Map(loadedSerialUnits.map((u) => [u.id, u]))
    for (const unitId of selectedSerialIds) {
      const unit = unitMap.get(unitId)
      const imeiLabel = unit ? (unit.imei ?? unit.imei2 ?? unit.serialNumber ?? null) : null
      addItem({
        productId: serialPickerProduct.productId,
        name: serialPickerProduct.name,
        sku: serialPickerProduct.sku ?? "",
        price: serialPickerProduct.price,
        costPrice: serialPickerProduct.costPrice,
        maxStock: 1,
        serialUnitId: unitId,
        imei: imeiLabel,
      })
    }
    setSerialPickerProduct(null)
    setSelectedSerialIds([])
    setLoadedSerialUnits([])
  }

  function handleClearCart() {
    clearCart()
    setClearConfirmOpen(false)
    toast.info("Корзина очищена")
  }

  // Build a unique key for cart item (for editingDiscount state and React key)
  function cartItemKey(item: { productId: string; serialUnitId?: string | null }): string {
    return item.serialUnitId ?? item.productId
  }

  if (!currentStoreId) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <Package className="mx-auto mb-4 size-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Выберите магазин</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Для работы с кассой необходимо выбрать магазин в боковом меню
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <ShiftBanner />
      {/* Search bar */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Поиск товара по названию, SKU, штрихкоду или IMEI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
            aria-label="Поиск товара"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHistoryOpen(true)}
          title="История продаж (текущая смена)"
        >
          <History className="mr-1 size-4" />
          История
        </Button>
        {currentStoreName && (
          <Badge variant="outline" className="shrink-0 whitespace-nowrap">
            {currentStoreName}
          </Badge>
        )}
      </div>

      {/* Main split layout — на мобильных (<md) показываем только товары, корзина в Sheet */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        {/* Left panel - Product search results (60% desktop, 100% mobile) */}
        <div className="flex w-full flex-col rounded-lg border md:w-[60%]">
          <div className="border-b px-3 py-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {search.trim() ? (
                <>
                  Результаты поиска
                  {products.length > 0 && <span className="ml-1">({products.length})</span>}
                </>
              ) : selectedCategoryId ? (
                <>
                  Категория:{" "}
                  <span className="font-semibold text-foreground">
                    {categories.find((c) => c.id === selectedCategoryId)?.name ?? ""}
                  </span>
                  {products.length > 0 && <span className="ml-1">({products.length})</span>}
                </>
              ) : (
                "Категории"
              )}
            </h3>
          </div>
          {/* UX2-17: Back-button "← Все категории" когда категория активна */}
          {selectedCategoryId && !search.trim() ? (
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCategoryId(null)
                  setProducts([])
                }}
                aria-label="Вернуться ко всем категориям"
              >
                ← Все категории
              </Button>
            </div>
          ) : null}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {searching ? (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                  ))}
                </div>
              ) : !search.trim() && !selectedCategoryId ? (
                /* UX2-17: Сетка категорий при пустом поиске и без активной категории */
                <CategoryGrid
                  categories={categories}
                  onSelect={(cat) => {
                    setSelectedCategoryId(cat.id)
                    setSearch("")
                  }}
                />
              ) : products.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Товары не найдены
                </div>
              ) : (
                /* UX2-08: 2 колонки на мобиле, 3 на md, 4 на lg */
                <div
                  className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4"
                  role="list"
                  aria-label="Найденные товары"
                >
                  {products.map((product) => (
                    <button
                      key={product.productId}
                      onClick={() => handleAddProduct(product)}
                      role="listitem"
                      aria-label={`Добавить ${product.name} в корзину, цена ${formatMoney(product.price)}`}
                      className="flex flex-col rounded-lg border p-3 text-left transition-colors hover:bg-muted active:bg-muted/70"
                    >
                      <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
                      <span className="mt-0.5 text-xs text-muted-foreground">{product.sku}</span>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <span className="font-semibold">{formatMoney(product.price)}</span>
                        {product.isSerialized ? (
                          <Badge variant="secondary" className="text-[10px]">
                            <Smartphone className="mr-0.5 size-2.5" />
                            {product.maxStock} шт
                          </Badge>
                        ) : (
                          <Badge
                            variant={product.maxStock <= 3 ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {product.maxStock} шт
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right panel - Cart (40%)
            UX2-04: Корзина заблокирована пока открыт PaymentDialog — визуальная
            и функциональная блокировка предотвращает случайное изменение items
            во время оформления оплаты (opacity-50 + pointer-events-none + aria-disabled).
            paymentOpen поднят в этот компонент как single source of truth. */}
        <div
          data-slot="pos-cart"
          aria-disabled={paymentOpen}
          aria-label="Корзина"
          className={`hidden w-[40%] flex-col rounded-lg border transition-opacity md:flex ${
            paymentOpen ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <ShoppingCart className="size-4" />
              Корзина
              {itemCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {itemCount}
                </Badge>
              )}
            </h3>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setClearConfirmOpen(true)}
                className="text-muted-foreground"
              >
                <Trash2 className="size-3" />
                Очистить
              </Button>
            )}
          </div>

          {/* Cart items */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {items.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  Корзина пуста
                </div>
              ) : (
                <div className="space-y-1">
                  {items.map((item) => {
                    const itemKey = cartItemKey(item)
                    return (
                      <div key={itemKey} className="rounded-lg border p-2">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            {item.imei && (
                              <p className="font-mono text-xs text-blue-500">{item.imei}</p>
                            )}
                            {item.serialUnitId && !item.imei && (
                              <p className="font-mono text-xs text-blue-500">
                                SN: {item.serialUnitId.slice(-8)}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {formatMoney(item.price)} / шт
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeItem(item.productId, item.serialUnitId)}
                            className="shrink-0 text-muted-foreground hover:text-red-500"
                            aria-label={`Удалить ${item.name} из корзины`}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>

                        <div className="mt-1.5 flex items-center justify-between">
                          {/* Quantity controls — hidden for serialized */}
                          {!item.serialUnitId ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon-xs"
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                aria-label={`Уменьшить количество ${item.name}`}
                              >
                                <Minus className="size-3" />
                              </Button>
                              <span
                                className="min-w-[2rem] text-center text-sm font-medium"
                                aria-label={`Количество: ${item.quantity}`}
                              >
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon-xs"
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                disabled={item.quantity >= item.maxStock}
                                aria-label={`Увеличить количество ${item.name}`}
                              >
                                <Plus className="size-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">1 шт</span>
                          )}

                          {/* Discount */}
                          <div className="flex items-center gap-1">
                            {editingDiscountKey === itemKey ? (
                              <Input
                                type="number"
                                className="h-6 w-20 text-xs"
                                placeholder="Скидка"
                                defaultValue={item.discount || ""}
                                autoFocus
                                onBlur={(e) => {
                                  applyDiscount(
                                    item.productId,
                                    Number(e.target.value) || 0,
                                    item.serialUnitId,
                                  )
                                  setEditingDiscountKey(null)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    applyDiscount(
                                      item.productId,
                                      Number(e.currentTarget.value) || 0,
                                      item.serialUnitId,
                                    )
                                    setEditingDiscountKey(null)
                                  }
                                  if (e.key === "Escape") {
                                    setEditingDiscountKey(null)
                                  }
                                }}
                              />
                            ) : (
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => setEditingDiscountKey(itemKey)}
                                className="text-xs text-muted-foreground"
                              >
                                <Percent className="mr-0.5 size-3" />
                                {item.discount > 0 ? `-${formatMoney(item.discount)}` : "Скидка"}
                              </Button>
                            )}
                          </div>

                          {/* Item total */}
                          <span className="text-sm font-semibold">{formatMoney(item.total)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Totals and payment button */}
          <div className="border-t p-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Итого:</span>
                <span>{formatMoney(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Скидка:</span>
                <span className={discount > 0 ? "text-red-500" : ""}>
                  {discount > 0 ? `-${formatMoney(discount)}` : formatMoney(0)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>К ОПЛАТЕ:</span>
                <span>{formatMoney(finalAmount)}</span>
              </div>
            </div>
            <Button
              size="lg"
              className="mt-3 w-full bg-green-600 text-white hover:bg-green-700"
              disabled={items.length === 0}
              onClick={() => setPaymentOpen(true)}
            >
              ОПЛАТА (F2)
            </Button>
          </div>
        </div>
      </div>

      {/* Hotkey bar */}
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span>F1 - Поиск</span>
        <span>F2 - Оплата</span>
        <span>Esc - Очистить</span>
      </div>

      {/* UX2-08: Mobile floating cart trigger (только < md, desktop имеет inline cart) */}
      <div className="fixed right-4 bottom-4 z-40 md:hidden">
        <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
          {/* UX2-08: Base UI Trigger — использовать render prop (не asChild, это codebase Base UI не Radix).
              Критично: children (иконка + текст) должны быть ВНУТРИ render-элемента, иначе trigger
              пустой и клик на видимую кнопку не открывает Sheet. */}
          <SheetTrigger
            render={
              <Button
                size="lg"
                className="rounded-full shadow-lg"
                aria-label={`Открыть корзину (${itemCount} товаров, к оплате ${formatMoney(finalAmount)})`}
                disabled={paymentOpen}
              >
                <ShoppingCart aria-hidden className="size-5" />
                <span className="ml-2">
                  {itemCount} · {formatMoney(finalAmount)}
                </span>
              </Button>
            }
          />
          <SheetContent side="right" className="flex w-[90vw] flex-col p-0 sm:w-[400px]">
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle>Корзина ({itemCount})</SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-3">
                {items.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                    Корзина пуста
                  </div>
                ) : (
                  items.map((item) => {
                    const itemKey = cartItemKey(item)
                    return (
                      <div key={itemKey} className="rounded-lg border p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            {item.imei && (
                              <p className="font-mono text-xs text-blue-500">{item.imei}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} × {formatMoney(item.price)}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{formatMoney(item.total)}</div>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => removeItem(item.productId, item.serialUnitId)}
                              className="text-muted-foreground hover:text-red-500"
                              aria-label={`Удалить ${item.name} из корзины`}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
            <div className="space-y-2 border-t p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Итого:</span>
                <span>{formatMoney(total)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Скидка:</span>
                  <span className="text-red-500">-{formatMoney(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold">
                <span>К ОПЛАТЕ:</span>
                <span>{formatMoney(finalAmount)}</span>
              </div>
              <Button
                size="lg"
                className="w-full bg-green-600 text-white hover:bg-green-700"
                disabled={items.length === 0}
                onClick={() => {
                  setMobileCartOpen(false)
                  setPaymentOpen(true)
                }}
                aria-label="Перейти к оплате"
              >
                ОПЛАТА
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Payment dialog */}
      <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} />

      {/* Sales history sheet */}
      <SalesHistory open={historyOpen} onOpenChange={setHistoryOpen} shiftId={currentShiftId} />

      {/* Clear cart confirmation */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Очистить корзину?</AlertDialogTitle>
            <AlertDialogDescription>
              Все товары будут удалены из корзины. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCart}>Очистить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Serial unit picker dialog */}
      {serialPickerProduct && currentStoreId && (
        <Dialog
          open={!!serialPickerProduct}
          onOpenChange={(open) => {
            if (!open) {
              setSerialPickerProduct(null)
              setSelectedSerialIds([])
            }
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Выберите серийный номер</DialogTitle>
              <DialogDescription>{serialPickerProduct.name}</DialogDescription>
            </DialogHeader>
            <SerialUnitPicker
              storeId={currentStoreId}
              productId={serialPickerProduct.productId}
              selectedIds={selectedSerialIds}
              onSelectionChange={setSelectedSerialIds}
              onUnitsLoaded={setLoadedSerialUnits}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSerialPickerProduct(null)
                  setSelectedSerialIds([])
                }}
              >
                Отмена
              </Button>
              <Button disabled={selectedSerialIds.length === 0} onClick={handleSerialPickerConfirm}>
                Добавить ({selectedSerialIds.length})
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
