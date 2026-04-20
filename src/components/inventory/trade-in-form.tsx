"use client"

/**
 * UX2-11 + INV-07 + INV-09: Trade-In form with
 *  - SINGLE "Цена выкупа" field (agreedPrice) — no estimatedPrice input
 *  - Inline warning when agreedPrice === 0 ("Бесплатный приём — уверены?")
 *  - RadioGroup operator выбирает initial status: PENDING | IN_STOCK
 */

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"

export interface TradeInFormValues {
  deviceType: string
  deviceBrand?: string
  deviceModel?: string
  deviceImei?: string
  deviceCondition: string
  agreedPrice: number
  initialStatus: "PENDING" | "IN_STOCK"
  comment?: string
}

export interface TradeInFormProps {
  initialValues?: Partial<TradeInFormValues>
  onSubmit: (values: TradeInFormValues) => Promise<void> | void
}

export function TradeInForm({ initialValues, onSubmit }: TradeInFormProps) {
  const [deviceType, setDeviceType] = useState(initialValues?.deviceType ?? "")
  const [deviceBrand, setDeviceBrand] = useState(initialValues?.deviceBrand ?? "")
  const [deviceModel, setDeviceModel] = useState(initialValues?.deviceModel ?? "")
  const [deviceImei, setDeviceImei] = useState(initialValues?.deviceImei ?? "")
  const [deviceCondition, setDeviceCondition] = useState(initialValues?.deviceCondition ?? "")
  const [agreedPriceStr, setAgreedPriceStr] = useState(
    initialValues?.agreedPrice !== undefined ? String(initialValues.agreedPrice) : "",
  )
  const [initialStatus, setInitialStatus] = useState<"PENDING" | "IN_STOCK">(
    initialValues?.initialStatus ?? "PENDING",
  )
  const [comment, setComment] = useState(initialValues?.comment ?? "")
  const [pending, setPending] = useState(false)

  const agreedPriceNum = Number(agreedPriceStr)
  const isFreePickup =
    agreedPriceStr !== "" && !Number.isNaN(agreedPriceNum) && agreedPriceNum === 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!deviceType || !deviceCondition || agreedPriceStr === "" || Number.isNaN(agreedPriceNum)) {
      return
    }
    setPending(true)
    try {
      await onSubmit({
        deviceType,
        deviceBrand: deviceBrand || undefined,
        deviceModel: deviceModel || undefined,
        deviceImei: deviceImei || undefined,
        deviceCondition,
        agreedPrice: agreedPriceNum,
        initialStatus,
        comment: comment || undefined,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="ti-device-type">Тип устройства *</Label>
          <Input
            id="ti-device-type"
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ti-device-brand">Бренд</Label>
          <Input
            id="ti-device-brand"
            value={deviceBrand}
            onChange={(e) => setDeviceBrand(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ti-device-model">Модель</Label>
          <Input
            id="ti-device-model"
            value={deviceModel}
            onChange={(e) => setDeviceModel(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ti-device-imei">IMEI</Label>
          <Input
            id="ti-device-imei"
            value={deviceImei}
            onChange={(e) => setDeviceImei(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="ti-condition">Состояние *</Label>
        <Textarea
          id="ti-condition"
          value={deviceCondition}
          onChange={(e) => setDeviceCondition(e.target.value)}
          required
        />
      </div>

      {/* UX2-11: SINGLE price field */}
      <div className="space-y-1">
        <Label htmlFor="ti-agreed-price">Цена выкупа *</Label>
        <Input
          id="ti-agreed-price"
          type="number"
          min="0"
          step="0.01"
          value={agreedPriceStr}
          onChange={(e) => setAgreedPriceStr(e.target.value)}
          required
        />
        {isFreePickup ? (
          <Alert>
            <AlertDescription>
              Бесплатный приём — уверены? Запись будет помечена в отчётах как безвозмездная.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      {/* INV-09: operator selects initial status */}
      <div className="space-y-2">
        <Label>Статус товара</Label>
        <RadioGroup
          value={initialStatus}
          onValueChange={(v) => setInitialStatus(v as "PENDING" | "IN_STOCK")}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem id="ti-status-pending" value="PENDING" />
            <Label htmlFor="ti-status-pending" className="cursor-pointer">
              Ожидает проверки (PENDING)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="ti-status-in-stock" value="IN_STOCK" />
            <Label htmlFor="ti-status-in-stock" className="cursor-pointer">
              Готов к продаже (IN_STOCK)
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-1">
        <Label htmlFor="ti-comment">Комментарий</Label>
        <Textarea id="ti-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>

      <Button type="submit" disabled={pending}>
        Создать trade-in
      </Button>
    </form>
  )
}
