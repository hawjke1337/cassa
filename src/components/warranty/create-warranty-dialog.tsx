"use client"

import { useState, useTransition } from "react"
import { lookupForWarrantyClaim, createWarrantyClaim } from "@/actions/warranty-claims"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"

interface CreateWarrantyDialogProps {
  storeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

type LookupResult = Awaited<ReturnType<typeof lookupForWarrantyClaim>>

export function CreateWarrantyDialog({
  storeId,
  open,
  onOpenChange,
  onCreated,
}: CreateWarrantyDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [imei, setImei] = useState("")
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [description, setDescription] = useState("")

  function reset() {
    setImei("")
    setLookupResult(null)
    setDescription("")
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset()
    onOpenChange(v)
  }

  async function handleLookup() {
    if (!imei.trim()) return
    setLookupLoading(true)
    try {
      const result = await lookupForWarrantyClaim(storeId, imei.trim())
      setLookupResult(result)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ошибка поиска устройства")
    } finally {
      setLookupLoading(false)
    }
  }

  function handleSubmit() {
    if (!lookupResult || lookupResult.type === "not_found") return
    if (!description.trim()) {
      toast.error("Укажите описание проблемы")
      return
    }

    startTransition(async () => {
      try {
        const data: Record<string, unknown> = {
          storeId,
          description: description.trim(),
        }

        if (lookupResult.type === "SALE_WARRANTY") {
          data.type = "SALE_WARRANTY"
          data.serialUnitId = lookupResult.serialUnitId
          data.deviceRecordId = lookupResult.deviceRecordId ?? null
        } else {
          data.type = "REPAIR_WARRANTY"
          data.repairId = lookupResult.repairId
          data.deviceRecordId = lookupResult.deviceRecordId ?? null
        }

        const result = await createWarrantyClaim(data)
        toast.success(`Обращение ${result.number} создано`)
        onCreated()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Ошибка создания обращения")
      }
    })
  }

  const isUnderWarranty =
    lookupResult !== null &&
    lookupResult.type !== "not_found" &&
    ("isUnderWarranty" in lookupResult ? lookupResult.isUnderWarranty : true)

  const canSubmit =
    lookupResult !== null &&
    lookupResult.type !== "not_found" &&
    isUnderWarranty &&
    description.trim().length > 0 &&
    !isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Новое гарантийное обращение</DialogTitle>
          <DialogDescription>
            Введите IMEI или серийный номер устройства для поиска
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* IMEI search */}
          <div className="space-y-2">
            <Label>IMEI / Серийный номер</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Введите IMEI..."
                value={imei}
                onChange={(e) => {
                  setImei(e.target.value)
                  if (lookupResult) setLookupResult(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLookup()
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleLookup}
                disabled={lookupLoading || !imei.trim()}
              >
                {lookupLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Lookup result banner */}
          {lookupResult && (
            <LookupBanner result={lookupResult} />
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label>Описание проблемы *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опишите проблему клиента..."
              rows={3}
              disabled={!lookupResult || lookupResult.type === "not_found"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Создать обращение
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LookupBanner({ result }: { result: LookupResult }) {
  if (result.type === "not_found") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-muted bg-muted/50 p-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          Устройство не найдено. Проверьте IMEI или серийный номер.
        </div>
      </div>
    )
  }

  if (result.type === "SALE_WARRANTY") {
    const warrantyEnd = result.warrantyEnd ? new Date(result.warrantyEnd) : null
    const isExpired = !result.isUnderWarranty

    return (
      <div
        className={`flex items-start gap-3 rounded-lg border p-3 ${
          isExpired
            ? "border-destructive/50 bg-destructive/10"
            : "border-green-500/50 bg-green-500/10"
        }`}
      >
        {isExpired ? (
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        ) : (
          <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
        )}
        <div className="space-y-1 text-sm">
          <div className="font-medium">{result.productName}</div>
          <div className="flex flex-wrap gap-2">
            {result.imei && (
              <span className="font-mono text-xs text-muted-foreground">
                IMEI: {result.imei}
              </span>
            )}
            <Badge variant="outline" className="text-xs">
              Гарантия на продажу
            </Badge>
          </div>
          {result.soldDate && (
            <div className="text-xs text-muted-foreground">
              Продано: {formatDate(result.soldDate)}
            </div>
          )}
          {warrantyEnd && (
            <div
              className={`text-xs ${
                isExpired
                  ? "text-destructive"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              Гарантия {isExpired ? "истекла" : "до"}: {formatDate(warrantyEnd.toISOString())}
            </div>
          )}
          {isExpired && (
            <div className="text-xs font-medium text-destructive">
              Гарантийный срок истёк
            </div>
          )}
        </div>
      </div>
    )
  }

  if (result.type === "REPAIR_WARRANTY") {
    const warrantyEnd = result.warrantyEnd ? new Date(result.warrantyEnd) : null

    return (
      <div className="flex items-start gap-3 rounded-lg border border-green-500/50 bg-green-500/10 p-3">
        <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
        <div className="space-y-1 text-sm">
          <div className="font-medium">
            {[result.deviceBrand, result.deviceModel].filter(Boolean).join(" ") ||
              "Устройство из ремонта"}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              Ремонт: {result.repairNumber}
            </span>
            <Badge variant="outline" className="text-xs">
              Гарантия на ремонт
            </Badge>
          </div>
          {warrantyEnd && (
            <div className="text-xs text-green-600 dark:text-green-400">
              Гарантия до: {formatDate(warrantyEnd.toISOString())}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
