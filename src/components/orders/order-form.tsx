"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createOrder, searchOrderProducts } from "@/actions/orders"
import { getSuppliersList } from "@/actions/suppliers"
import { formatMoney } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Search, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface OrderFormProps {
  storeId: string
}

interface OrderItem {
  productId?: string
  name: string
  quantity: number
  price: number
  costPrice?: number
  requiresImei?: boolean
}

export function OrderForm({ storeId }: OrderFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [clientName, setClientName] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [supplierId, setSupplierId] = useState<string>("")
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [comment, setComment] = useState("")
  const [items, setItems] = useState<OrderItem[]>([])

  useEffect(() => {
    getSuppliersList().then(setSuppliers).catch(() => {})
  }, [])

  // Product search
  const [productSearch, setProductSearch] = useState("")
  const [searchResults, setSearchResults] = useState<
    Awaited<ReturnType<typeof searchOrderProducts>>
  >([])
  const [searching, setSearching] = useState(false)

  // Manual item
  const [manualName, setManualName] = useState("")
  const [manualPrice, setManualPrice] = useState("")
  const [manualQty, setManualQty] = useState("1")
  const [manualRequiresImei, setManualRequiresImei] = useState(false)

  const totalAmount = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  async function handleSearch(query: string) {
    setProductSearch(query)
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await searchOrderProducts(storeId, query)
      setSearchResults(results)
    } catch {
      // ignore
    } finally {
      setSearching(false)
    }
  }

  function addProductItem(product: (typeof searchResults)[number]) {
    const existing = items.findIndex(
      (i) => i.productId === product.productId
    )
    if (existing >= 0) {
      const updated = [...items]
      updated[existing].quantity += 1
      setItems(updated)
    } else {
      setItems([
        ...items,
        {
          productId: product.productId,
          name: product.name,
          quantity: 1,
          price: product.price,
          costPrice: product.costPrice ?? undefined,
          requiresImei: product.isSerialized,
        },
      ])
    }
    setProductSearch("")
    setSearchResults([])
  }

  function addManualItem() {
    if (!manualName.trim()) {
      toast.error("Введите название товара")
      return
    }
    const price = parseFloat(manualPrice)
    if (isNaN(price) || price <= 0) {
      toast.error("Введите корректную цену")
      return
    }
    const qty = parseInt(manualQty) || 1

    setItems([
      ...items,
      { name: manualName.trim(), quantity: qty, price, requiresImei: manualRequiresImei },
    ])
    setManualName("")
    setManualPrice("")
    setManualQty("1")
    setManualRequiresImei(false)
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  function updateItemQty(index: number, qty: number) {
    if (qty < 1) return
    const updated = [...items]
    updated[index].quantity = qty
    setItems(updated)
  }

  function handleSubmit() {
    if (!clientName.trim()) {
      toast.error("Укажите имя клиента")
      return
    }
    if (!clientPhone.trim()) {
      toast.error("Укажите телефон клиента")
      return
    }
    if (items.length === 0) {
      toast.error("Добавьте хотя бы один товар")
      return
    }

    startTransition(async () => {
      try {
        const result = await createOrder({
          storeId,
          clientName,
          clientPhone,
          clientEmail: clientEmail || undefined,
          supplierId: supplierId && supplierId !== "__none__" ? supplierId : undefined,
          items: items.map((i) => ({
            ...i,
            requiresImei: i.requiresImei ?? false,
          })),
          comment: comment || undefined,
        })
        toast.success(`Заказ ${result.number} создан`)
        router.push(`/orders/${result.id}`)
      } catch (err: any) {
        toast.error(err.message || "Ошибка создания заказа")
      }
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: Client info + Comment */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Клиент</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Имя *</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Иванов Иван"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientPhone">Телефон *</Label>
              <Input
                id="clientPhone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+7 999 123-45-67"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Email</Label>
              <Input
                id="clientEmail"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            {suppliers.length > 0 && (
              <div className="space-y-2">
                <Label>Поставщик</Label>
                <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите поставщика" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Без поставщика</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Комментарий</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Заметки по заказу..."
              rows={3}
            />
          </CardContent>
        </Card>
      </div>

      {/* Right: Items */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Товары</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search products */}
            <div className="space-y-2">
              <Label>Поиск из каталога</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Название, артикул, штрихкод..."
                  className="pl-8"
                />
                {searching && (
                  <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border bg-popover">
                  {searchResults.map((p) => (
                    <button
                      key={p.productId}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => addProductItem(p)}
                    >
                      <div className="text-left">
                        <div>{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.sku}
                        </div>
                      </div>
                      <span className="font-mono">
                        {formatMoney(p.price)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Manual add */}
            <div className="space-y-2">
              <Label>Или добавить вручную</Label>
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
                <Input
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                  placeholder="Кол"
                  type="number"
                  className="w-16"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addManualItem}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="manualRequiresImei"
                  checked={manualRequiresImei}
                  onCheckedChange={(v) => setManualRequiresImei(v === true)}
                />
                <Label htmlFor="manualRequiresImei" className="text-sm text-muted-foreground cursor-pointer">
                  Серийный товар (потребуется IMEI при выдаче)
                </Label>
              </div>
            </div>

            {/* Items table */}
            {items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="w-20 text-center">Кол-во</TableHead>
                    <TableHead className="w-24 text-right">Цена</TableHead>
                    <TableHead className="w-24 text-right">Итого</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {item.name}
                          {item.requiresImei && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              IMEI
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemQty(idx, parseInt(e.target.value) || 1)
                          }
                          className="h-7 w-16 text-center"
                          min={1}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.price}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            if (isNaN(val) || val < 0) return
                            const updated = [...items]
                            updated[idx].price = val
                            setItems(updated)
                          }}
                          className="h-7 w-24 text-right font-mono"
                          min={0}
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(item.price * item.quantity)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeItem(idx)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Total */}
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-lg font-semibold">Итого:</span>
              <span className="text-lg font-bold">
                {formatMoney(totalAmount)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : null}
          Создать заказ
        </Button>
      </div>
    </div>
  )
}
