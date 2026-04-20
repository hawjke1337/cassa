"use client"

/**
 * INV-01: Category edit form with isSerialized guard + admin force override.
 *
 * Regular user: sees disabled toggle + tooltip when category has SerialUnits.
 * Admin: sees AlertDialog warning with reason Textarea + forceOverride confirmation.
 *
 * Emits onSubmit with { forceOverride, forceReason } when admin confirms override.
 */

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getCategorySerialCount } from "@/actions/catalog"

export interface CategoryFormValues {
  name: string
  parentId?: string | null
  isSerialized: boolean
  identifierType?: "IMEI" | "SN" | "BOTH" | null
  forceOverride?: boolean
  forceReason?: string
}

export interface CategoryFormProps {
  initialValues?: Partial<CategoryFormValues> & { id?: string }
  isAdmin: boolean
  onSubmit: (values: CategoryFormValues) => Promise<void> | void
  onCancel?: () => void
}

export function CategoryForm({ initialValues, isAdmin, onSubmit, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "")
  const [isSerialized, setIsSerialized] = useState(Boolean(initialValues?.isSerialized))
  const [identifierType, setIdentifierType] = useState<"IMEI" | "SN" | "BOTH" | null>(
    initialValues?.identifierType ?? null,
  )
  const [counts, setCounts] = useState<{ serialCount: number; stockCount: number }>({
    serialCount: 0,
    stockCount: 0,
  })
  const [showForceDialog, setShowForceDialog] = useState(false)
  const [forceReason, setForceReason] = useState("")
  const [pending, setPending] = useState(false)

  const hasExistingSerials = counts.serialCount > 0 || counts.stockCount > 0
  const initialSerialized = Boolean(initialValues?.isSerialized)
  const isAttemptingFlip = hasExistingSerials && isSerialized !== initialSerialized

  useEffect(() => {
    if (!initialValues?.id) return
    let cancelled = false
    getCategorySerialCount(initialValues.id)
      .then((res) => {
        if (!cancelled) setCounts(res)
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [initialValues?.id])

  const guardTooltip = hasExistingSerials
    ? `Нельзя: ${counts.serialCount} серийных единиц, ${counts.stockCount} товаров с остатками`
    : undefined

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSerialized && !identifierType) return
    if (isAttemptingFlip) {
      if (!isAdmin) return
      setShowForceDialog(true)
      return
    }
    setPending(true)
    try {
      await onSubmit({ name, isSerialized, identifierType })
    } finally {
      setPending(false)
    }
  }

  async function handleForceConfirm() {
    if (!forceReason.trim()) return
    setPending(true)
    try {
      await onSubmit({
        name,
        isSerialized,
        identifierType,
        forceOverride: true,
        forceReason,
      })
      setShowForceDialog(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category-name">Название</Label>
        <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-1">
          <Label htmlFor="category-serialized">Серийная категория</Label>
          {guardTooltip && !isAdmin ? (
            <p className="text-xs text-muted-foreground">{guardTooltip}</p>
          ) : guardTooltip && isAdmin ? (
            <p className="text-xs text-amber-600">⚠ {guardTooltip} — admin override доступен</p>
          ) : null}
        </div>
        <Switch
          id="category-serialized"
          checked={isSerialized}
          disabled={hasExistingSerials && !isAdmin}
          onCheckedChange={setIsSerialized}
        />
      </div>

      {isSerialized ? (
        <div className="space-y-2">
          <Label>Тип идентификатора</Label>
          <div className="flex gap-2">
            {(["IMEI", "SN", "BOTH"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setIdentifierType(type)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  identifierType === type
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {type === "IMEI"
                  ? "IMEI (телефоны)"
                  : type === "SN"
                    ? "SN (аксессуары)"
                    : "IMEI + SN (dual)"}
              </button>
            ))}
          </div>
          {!identifierType ? (
            <p className="text-xs text-destructive">Выберите тип идентификатора</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
        ) : null}
        <Button type="submit" disabled={pending || (isSerialized && !identifierType)}>
          Сохранить
        </Button>
      </div>

      <AlertDialog open={showForceDialog} onOpenChange={setShowForceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Принудительная смена серийного режима</AlertDialogTitle>
            <AlertDialogDescription>
              В категории есть {counts.serialCount} серийных единиц и {counts.stockCount} товаров с
              остатками. Смена режима может создать несогласованное состояние. Укажите причину
              принудительной смены — запись будет добавлена в AuditLog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Причина (обязательно)"
            value={forceReason}
            onChange={(e) => setForceReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={handleForceConfirm}
              disabled={!forceReason.trim() || pending}
            >
              Подтверждаю принудительную смену
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
