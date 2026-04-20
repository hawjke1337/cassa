"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getWarrantyClaim, updateWarrantyClaimStatus } from "@/actions/warranty-claims"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Phone,
  Loader2,
  Package,
  Wrench,
  CheckCircle,
  XCircle,
  Truck,
  Clock,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import {
  WARRANTY_STATUS_LABELS,
  WARRANTY_STATUS_COLORS,
} from "./warranty-list-client"

type ClaimData = Awaited<ReturnType<typeof getWarrantyClaim>>

interface WarrantyDetailClientProps {
  id: string
  canManage: boolean
}

const WARRANTY_TYPE_LABELS: Record<string, string> = {
  SALE_WARRANTY: "Гарантия на продажу",
  REPAIR_WARRANTY: "Гарантия на ремонт",
}

const WARRANTY_TYPE_COLORS: Record<string, string> = {
  SALE_WARRANTY: "border-blue-500 text-blue-600 dark:text-blue-400",
  REPAIR_WARRANTY: "border-orange-500 text-orange-600 dark:text-orange-400",
}

const SERIAL_EVENT_LABELS: Record<string, string> = {
  RECEIVED: "Получено",
  TRANSFERRED_OUT: "Перемещено (исх.)",
  TRANSFERRED_IN: "Перемещено (вх.)",
  SOLD: "Продано",
  RETURNED: "Возврат",
  WRITTEN_OFF: "Списано",
  REPAIR_IN: "Принято в ремонт",
  REPAIR_OUT: "Выдано из ремонта",
  COST_ADJUSTED: "Корректировка цены",
  IMEI_CORRECTED: "Исправление IMEI",
}

export function WarrantyDetailClient({ id, canManage }: WarrantyDetailClientProps) {
  const router = useRouter()
  const [claim, setClaim] = useState<ClaimData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [resolutionDialog, setResolutionDialog] = useState<{
    open: boolean
    targetStatus: "RESOLVED" | "REJECTED" | null
  }>({ open: false, targetStatus: null })
  const [resolution, setResolution] = useState("")

  const loadClaim = useCallback(async () => {
    try {
      const data = await getWarrantyClaim(id)
      setClaim(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ошибка загрузки обращения")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadClaim()
  }, [loadClaim])

  function handleStatusChange(newStatus: string, res?: string) {
    startTransition(async () => {
      try {
        await updateWarrantyClaimStatus({
          id,
          status: newStatus,
          resolution: res ?? undefined,
        })
        toast.success(`Статус изменён: ${WARRANTY_STATUS_LABELS[newStatus] ?? newStatus}`)
        await loadClaim()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Ошибка смены статуса")
      }
    })
  }

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!claim) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground">
        Обращение не найдено
      </div>
    )
  }

  const isTerminal = claim.status === "RESOLVED" || claim.status === "REJECTED"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/warranty")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{claim.number}</h1>
              <Badge
                variant="outline"
                className={WARRANTY_STATUS_COLORS[claim.status] ?? ""}
              >
                {WARRANTY_STATUS_LABELS[claim.status] ?? claim.status}
              </Badge>
              <Badge
                variant="outline"
                className={WARRANTY_TYPE_COLORS[claim.type] ?? ""}
              >
                {WARRANTY_TYPE_LABELS[claim.type] ?? claim.type}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {claim.createdByName} &middot; {claim.storeName} &middot;{" "}
              {formatDate(claim.createdAt)}
            </p>
          </div>
        </div>

        {/* Status Actions */}
        {canManage && !isTerminal && (
          <div className="flex flex-wrap gap-2">
            {claim.status === "RECEIVED" && (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => handleStatusChange("DIAGNOSING")}
              >
                <Search className="size-4" />
                Начать диагностику
              </Button>
            )}
            {claim.status === "DIAGNOSING" && (
              <>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleStatusChange("SENT_TO_SUPPLIER")}
                >
                  <Truck className="size-4" />
                  Отправить поставщику
                </Button>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    setResolution("")
                    setResolutionDialog({ open: true, targetStatus: "RESOLVED" })
                  }}
                >
                  <CheckCircle className="size-4" />
                  Решено
                </Button>
                <Button
                  variant="ghost"
                  disabled={isPending}
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setResolution("")
                    setResolutionDialog({ open: true, targetStatus: "REJECTED" })
                  }}
                >
                  <XCircle className="size-4" />
                  Отклонить
                </Button>
              </>
            )}
            {claim.status === "SENT_TO_SUPPLIER" && (
              <>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleStatusChange("REPLACEMENT_PENDING")}
                >
                  <Clock className="size-4" />
                  Ожидание замены
                </Button>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    setResolution("")
                    setResolutionDialog({ open: true, targetStatus: "RESOLVED" })
                  }}
                >
                  <CheckCircle className="size-4" />
                  Решено
                </Button>
              </>
            )}
            {claim.status === "REPLACEMENT_PENDING" && (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setResolution("")
                  setResolutionDialog({ open: true, targetStatus: "RESOLVED" })
                }}
              >
                <CheckCircle className="size-4" />
                Решено
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Описание проблемы</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{claim.description}</p>
              {claim.resolution && (
                <div className="mt-4 rounded-lg bg-muted p-3">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Решение:</div>
                  <p className="text-sm">{claim.resolution}</p>
                  {claim.resolvedAt && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(claim.resolvedAt)}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Device info */}
          {claim.serialUnit && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="size-4" />
                  Устройство
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Товар: </span>
                    <span className="text-sm font-medium">{claim.serialUnit.productName}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Артикул: </span>
                    <span className="font-mono text-sm">{claim.serialUnit.productSku}</span>
                  </div>
                  {claim.serialUnit.imei && (
                    <div>
                      <span className="text-sm text-muted-foreground">IMEI: </span>
                      <span className="font-mono text-sm">{claim.serialUnit.imei}</span>
                    </div>
                  )}
                  {claim.serialUnit.imei2 && (
                    <div>
                      <span className="text-sm text-muted-foreground">IMEI 2: </span>
                      <span className="font-mono text-sm">{claim.serialUnit.imei2}</span>
                    </div>
                  )}
                  {claim.serialUnit.serialNumber && (
                    <div>
                      <span className="text-sm text-muted-foreground">Серийный номер: </span>
                      <span className="font-mono text-sm">{claim.serialUnit.serialNumber}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-muted-foreground">Гарантия: </span>
                    <span className="text-sm">{claim.serialUnit.warrantyDays} дн.</span>
                  </div>
                </div>

                {/* History timeline */}
                {claim.serialUnit.history.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-3 text-sm font-medium">История устройства</div>
                    <div className="relative space-y-3 pl-4">
                      <div className="absolute left-1.5 top-2 h-[calc(100%-16px)] w-px bg-border" />
                      {claim.serialUnit.history.map((h) => (
                        <div key={h.id} className="relative flex gap-3">
                          <div className="absolute -left-2.5 mt-1.5 size-2 rounded-full bg-muted-foreground" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium">
                              {SERIAL_EVENT_LABELS[h.event] ?? h.event}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {h.storeName} &middot; {h.performedByName}
                              {h.relatedDocument && (
                                <> &middot; {h.relatedDocument}</>
                              )}
                            </div>
                            {h.comment && (
                              <div className="text-xs text-muted-foreground">{h.comment}</div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {formatDate(h.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Repair info */}
          {claim.repair && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="size-4" />
                  Ремонт
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Номер: </span>
                    <span className="font-mono text-sm">{claim.repair.number}</span>
                  </div>
                  {(claim.repair.deviceBrand || claim.repair.deviceModel) && (
                    <div>
                      <span className="text-sm text-muted-foreground">Устройство: </span>
                      <span className="text-sm">
                        {[claim.repair.deviceBrand, claim.repair.deviceModel]
                          .filter(Boolean)
                          .join(" ")}
                      </span>
                    </div>
                  )}
                  {claim.repair.warrantyUntil && (
                    <div>
                      <span className="text-sm text-muted-foreground">Гарантия до: </span>
                      <span className="text-sm">{formatDate(claim.repair.warrantyUntil)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* DeviceRecord fallback */}
          {!claim.serialUnit && !claim.repair && claim.deviceRecord && (
            <Card>
              <CardHeader>
                <CardTitle>Устройство</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Тип: </span>
                    <span className="text-sm">{claim.deviceRecord.deviceType}</span>
                  </div>
                  {claim.deviceRecord.brand && (
                    <div>
                      <span className="text-sm text-muted-foreground">Бренд: </span>
                      <span className="text-sm">{claim.deviceRecord.brand}</span>
                    </div>
                  )}
                  {claim.deviceRecord.model && (
                    <div>
                      <span className="text-sm text-muted-foreground">Модель: </span>
                      <span className="text-sm">{claim.deviceRecord.model}</span>
                    </div>
                  )}
                  {claim.deviceRecord.imei && (
                    <div>
                      <span className="text-sm text-muted-foreground">IMEI: </span>
                      <span className="font-mono text-sm">{claim.deviceRecord.imei}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle>Клиент</CardTitle>
            </CardHeader>
            <CardContent>
              {claim.customer ? (
                <div className="space-y-2">
                  <div className="font-medium">{claim.customer.name}</div>
                  {claim.customer.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="size-3.5 text-muted-foreground" />
                      <a
                        href={`tel:${claim.customer.phone}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {claim.customer.phone}
                      </a>
                    </div>
                  )}
                </div>
              ) : claim.repair ? (
                <div className="space-y-2">
                  <div className="font-medium">{claim.repair.clientName}</div>
                  {claim.repair.clientPhone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="size-3.5 text-muted-foreground" />
                      <a
                        href={`tel:${claim.repair.clientPhone}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {claim.repair.clientPhone}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Не указан</div>
              )}
            </CardContent>
          </Card>

          {/* Claim info */}
          <Card>
            <CardHeader>
              <CardTitle>Сведения</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Создано: </span>
                {formatDate(claim.createdAt)}
              </div>
              <div>
                <span className="text-muted-foreground">Магазин: </span>
                {claim.storeName}
              </div>
              <div>
                <span className="text-muted-foreground">Принял: </span>
                {claim.createdByName}
              </div>
              {claim.resolvedAt && (
                <div>
                  <span className="text-muted-foreground">Закрыто: </span>
                  {formatDate(claim.resolvedAt)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Resolution Dialog */}
      <Dialog
        open={resolutionDialog.open}
        onOpenChange={(v) => setResolutionDialog({ open: v, targetStatus: v ? resolutionDialog.targetStatus : null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resolutionDialog.targetStatus === "RESOLVED"
                ? "Закрыть обращение"
                : "Отклонить обращение"}
            </DialogTitle>
            <DialogDescription>
              {resolutionDialog.targetStatus === "RESOLVED"
                ? "Опишите, как была решена проблема"
                : "Укажите причину отклонения"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Комментарий</Label>
            <Textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder={
                resolutionDialog.targetStatus === "RESOLVED"
                  ? "Описание решения..."
                  : "Причина отклонения..."
              }
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant={resolutionDialog.targetStatus === "REJECTED" ? "destructive" : "default"}
              disabled={isPending}
              onClick={() => {
                if (resolutionDialog.targetStatus) {
                  handleStatusChange(resolutionDialog.targetStatus, resolution || undefined)
                  setResolutionDialog({ open: false, targetStatus: null })
                }
              }}
            >
              {resolutionDialog.targetStatus === "RESOLVED" ? "Закрыть" : "Отклонить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
