"use client"

/**
 * INV-06: Receive form with MANDATORY sellPrice for new StoreProduct creation.
 *
 * Presentational component — consumers wire server action (confirmReceive).
 * Validation: sellPrice is required and must be > 0 when item represents a
 * product that doesn't yet exist at the destination store (isNewProduct).
 *
 * No auto-calc from costPrice*markup (INV-06 locks operator responsibility).
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface ReceiveFormItem {
  productId: string
  name: string
  quantity: number
  costPrice: number
  isNewProduct: boolean
  sellPrice?: number
}

export interface ReceiveFormProps {
  items: ReceiveFormItem[]
  onConfirm: (sellPrices: Record<string, number>) => Promise<void> | void
}

export function ReceiveForm({ items, onConfirm }: ReceiveFormProps) {
  const [sellPrices, setSellPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((it) => [it.productId, it.sellPrice ? String(it.sellPrice) : ""])),
  )
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [pending, setPending] = useState(false)

  function validate(): Record<string, number> | null {
    const next: Record<string, string | null> = {}
    const parsed: Record<string, number> = {}
    for (const it of items) {
      if (!it.isNewProduct) continue
      const raw = sellPrices[it.productId]
      const num = Number(raw)
      if (!raw || Number.isNaN(num) || num <= 0) {
        next[it.productId] = "Обязательное поле: цена продажи > 0"
      } else {
        parsed[it.productId] = num
        next[it.productId] = null
      }
    }
    setErrors(next)
    if (Object.values(next).some((e) => e !== null)) return null
    return parsed
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const prices = validate()
    if (!prices) return
    setPending(true)
    try {
      await onConfirm(prices)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {items.map((it) => (
        <div key={it.productId} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{it.name}</p>
              <p className="text-xs text-muted-foreground">
                Кол: {it.quantity} · Себестоимость: {it.costPrice}
              </p>
            </div>
            {it.isNewProduct ? (
              <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
                Новый товар
              </span>
            ) : null}
          </div>

          {it.isNewProduct ? (
            <div className="space-y-1">
              <Label htmlFor={`sellprice-${it.productId}`}>Цена продажи *</Label>
              <Input
                id={`sellprice-${it.productId}`}
                type="number"
                min="0.01"
                step="0.01"
                required
                value={sellPrices[it.productId] ?? ""}
                onChange={(e) =>
                  setSellPrices((prev) => ({ ...prev, [it.productId]: e.target.value }))
                }
                aria-invalid={Boolean(errors[it.productId])}
              />
              {errors[it.productId] ? (
                <p className="text-xs text-destructive">{errors[it.productId]}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}

      <Button type="submit" disabled={pending}>
        Подтвердить приём
      </Button>
    </form>
  )
}
