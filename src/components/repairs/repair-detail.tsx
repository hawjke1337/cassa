"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  getRepair,
  updateRepairStatus,
  updateRepair,
  addRepairPayment,
  getStoreMasters,
} from "@/actions/repairs"
import { formatMoney, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import {
  Loader2,
  ArrowLeft,
  Phone,
  Printer,
  Search,
  Wrench,
  Clock,
  CheckCircle,
  HandCoins,
  PackageCheck,
  Ban,
  CreditCard,
  Eye,
  EyeOff,
  Pencil,
} from "lucide-react"
import { toast } from "sonner"
import { RepairTimeline } from "./repair-timeline"
import {
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
} from "./repair-status"
import type { RepairStatus, PaymentMethod } from "@/generated/prisma/client"

type RepairData = Awaited<ReturnType<typeof getRepair>>

interface RepairDetailProps {
  repairId: string
  canManage: boolean
  canWarranty: boolean
}

const TERMINAL_STATUSES: RepairStatus[] = ["DELIVERED", "CANCELLED"]

export function RepairDetail({ repairId, canManage, canWarranty }: RepairDetailProps) {
  const router = useRouter()
  const [repair, setRepair] = useState<RepairData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)

  const loadRepair = useCallback(async () => {
    try {
      const data = await getRepair(repairId)
      setRepair(data)
    } catch (err: any) {
      toast.error(err.message || "Ошибка загрузки ремонта")
    } finally {
      setLoading(false)
    }
  }, [repairId])

  useEffect(() => {
    loadRepair()
  }, [loadRepair])

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!repair) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground">
        Ремонт не найден
      </div>
    )
  }

  const status = repair.status as RepairStatus
  const currentCost = repair.finalCost ?? repair.agreedCost ?? repair.estimatedCost ?? 0
  const remainingAmount = currentCost - repair.totalPaid

  function handleStatusChange(
    newStatus: RepairStatus,
    comment?: string,
    extraData?: any
  ) {
    startTransition(async () => {
      try {
        await updateRepairStatus(repairId, newStatus, comment, extraData)
        toast.success(`Статус изменён: ${REPAIR_STATUS_LABELS[newStatus]}`)
        await loadRepair()
      } catch (err: any) {
        toast.error(err.message || "Ошибка смены статуса")
      }
    })
  }

  function handlePayment(method: PaymentMethod, amount: number) {
    startTransition(async () => {
      try {
        await addRepairPayment(repairId, { method, amount })
        toast.success("Оплата принята")
        await loadRepair()
      } catch (err: any) {
        toast.error(err.message || "Ошибка оплаты")
      }
    })
  }

  function handleUpdate(data: any) {
    startTransition(async () => {
      try {
        await updateRepair(repairId, data)
        toast.success("Ремонт обновлён")
        await loadRepair()
      } catch (err: any) {
        toast.error(err.message || "Ошибка обновления")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/repairs")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{repair.number}</h1>
              <Badge
                variant="outline"
                className={REPAIR_STATUS_COLORS[status]}
              >
                {REPAIR_STATUS_LABELS[status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {repair.createdByName} &middot; {repair.storeName} &middot;{" "}
              {formatDate(repair.createdAt)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(`/print/repair-receipt/${repairId}`, "_blank")}
          >
            <Printer className="size-4" />
            Акт приёмки
          </Button>
          {status === "DELIVERED" && (
            <Button
              variant="outline"
              onClick={() => window.open(`/print/repair-delivery/${repairId}`, "_blank")}
            >
              <Printer className="size-4" />
              Акт выдачи
            </Button>
          )}
          {canManage && (
            <RepairActions
              status={status}
              repair={repair}
              isPending={isPending}
              remainingAmount={remainingAmount}
              onStatusChange={handleStatusChange}
              onPayment={handlePayment}
              onUpdate={handleUpdate}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Client info */}
          <Card>
            <CardHeader>
              <CardTitle>Клиент</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <span>{repair.clientName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" />
                  <a
                    href={`tel:${repair.clientPhone}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {repair.clientPhone}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Device info */}
          <Card>
            <CardHeader>
              <CardTitle>Устройство</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="text-sm text-muted-foreground">Тип: </span>
                  <span>{repair.deviceType}</span>
                </div>
                {repair.deviceBrand && (
                  <div>
                    <span className="text-sm text-muted-foreground">Бренд: </span>
                    <span>{repair.deviceBrand}</span>
                  </div>
                )}
                {repair.deviceModel && (
                  <div>
                    <span className="text-sm text-muted-foreground">Модель: </span>
                    <span>{repair.deviceModel}</span>
                  </div>
                )}
                {repair.deviceSerial && (
                  <div>
                    <span className="text-sm text-muted-foreground">Серийный номер: </span>
                    <span className="font-mono">{repair.deviceSerial}</span>
                  </div>
                )}
                {repair.deviceCondition && (
                  <div className="sm:col-span-2">
                    <span className="text-sm text-muted-foreground">Состояние: </span>
                    <span>{repair.deviceCondition}</span>
                  </div>
                )}
                {repair.devicePassword && (
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Пароль: </span>
                    <span className="font-mono">
                      {showPassword ? repair.devicePassword : "••••••••"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Work info */}
          <Card>
            <CardHeader>
              <CardTitle>Работа</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">Неисправность: </span>
                  <span>{repair.defectDescription}</span>
                </div>
                {repair.diagnosis && (
                  <div>
                    <span className="text-sm text-muted-foreground">Диагноз: </span>
                    <span>{repair.diagnosis}</span>
                  </div>
                )}
                {repair.workDone && (
                  <div>
                    <span className="text-sm text-muted-foreground">Выполненные работы: </span>
                    <span>{repair.workDone}</span>
                  </div>
                )}
                {repair.masterName && (
                  <div>
                    <span className="text-sm text-muted-foreground">Мастер: </span>
                    <span>{repair.masterName}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cost and payments */}
          <Card>
            <CardHeader>
              <CardTitle>Стоимость и оплаты</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {repair.estimatedCost !== null && (
                  <div>
                    <span className="text-sm text-muted-foreground">Предварительная: </span>
                    <span className="font-mono">{formatMoney(repair.estimatedCost)}</span>
                  </div>
                )}
                {repair.agreedCost !== null && (
                  <div>
                    <span className="text-sm text-muted-foreground">Согласованная: </span>
                    <span className="font-mono">{formatMoney(repair.agreedCost)}</span>
                  </div>
                )}
                {repair.finalCost !== null && (
                  <div>
                    <span className="text-sm text-muted-foreground">Итоговая: </span>
                    <span className="font-mono">{formatMoney(repair.finalCost)}</span>
                  </div>
                )}
              </div>

              {repair.payments.length > 0 && (
                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Способ</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead>Дата</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repair.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatMoney(p.amount)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(p.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="mt-4 space-y-1 text-right">
                <div className="text-sm text-muted-foreground">
                  Оплачено: <span className="font-mono text-green-400">{formatMoney(repair.totalPaid)}</span>
                </div>
                {remainingAmount > 0 && !TERMINAL_STATUSES.includes(status) && (
                  <div className="text-sm text-muted-foreground">
                    Остаток: <span className="font-mono text-yellow-400">{formatMoney(remainingAmount)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Warranty */}
          {repair.warrantyUntil && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Гарантия
                  <Badge variant="outline">
                    {repair.warrantyDays} дн.
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Гарантия до: {formatDate(repair.warrantyUntil)}
                </div>
                {repair.warrantyClaims.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-sm font-medium">Гарантийные обращения:</div>
                    {repair.warrantyClaims.map((c) => (
                      <div key={c.id} className="rounded-lg bg-muted p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span>{c.description}</span>
                          <Badge variant="outline" className="text-xs">
                            {c.status}
                          </Badge>
                        </div>
                        {c.resolution && (
                          <div className="mt-1 text-muted-foreground">
                            Решение: {c.resolution}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(c.createdAt)}
                          {c.resolvedAt && ` — ${formatDate(c.resolvedAt)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Comment */}
          {repair.comment && (
            <Card>
              <CardHeader>
                <CardTitle>Комментарий</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-3 text-sm">
                  {repair.comment}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Timeline */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>История</CardTitle>
            </CardHeader>
            <CardContent>
              <RepairTimeline
                history={repair.statusHistory}
                currentStatus={repair.status}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---- Action Buttons based on status ----

interface RepairActionsProps {
  status: RepairStatus
  repair: RepairData
  isPending: boolean
  remainingAmount: number
  onStatusChange: (
    status: RepairStatus,
    comment?: string,
    extraData?: any
  ) => void
  onPayment: (method: PaymentMethod, amount: number) => void
  onUpdate: (data: any) => void
}

function RepairActions({
  status,
  repair,
  isPending,
  remainingAmount,
  onStatusChange,
  onPayment,
  onUpdate,
}: RepairActionsProps) {
  const actions: React.ReactNode[] = []
  const isTerminal = TERMINAL_STATUSES.includes(status)

  if (status === "RECEIVED") {
    actions.push(
      <AssignMasterDialog
        key="assign"
        storeId={repair.storeId}
        isPending={isPending}
        onConfirm={(masterId) => {
          onStatusChange("DIAGNOSING", "Начата диагностика", { masterId })
        }}
      />
    )
  }

  if (status === "DIAGNOSING") {
    actions.push(
      <DiagnosisDialog
        key="diagnosis"
        isPending={isPending}
        onConfirm={(diagnosis, estimatedCost) => {
          onStatusChange("WAITING_APPROVAL", "Диагностика завершена", {
            diagnosis,
            estimatedCost: estimatedCost ? parseFloat(String(estimatedCost)) : undefined,
          })
        }}
      />
    )
  }

  if (status === "WAITING_APPROVAL") {
    actions.push(
      <ApprovalDialog
        key="approval"
        defaultCost={repair.estimatedCost}
        isPending={isPending}
        onConfirm={(agreedCost) => {
          onStatusChange("APPROVED", "Клиент согласовал стоимость", { agreedCost })
        }}
      />
    )
  }

  if (status === "APPROVED") {
    actions.push(
      <Button
        key="start"
        variant="outline"
        disabled={isPending}
        onClick={() => onStatusChange("IN_PROGRESS", "Ремонт начат")}
      >
        <Wrench className="size-4" />
        Начать ремонт
      </Button>
    )
  }

  if (status === "IN_PROGRESS") {
    actions.push(
      <CompletionDialog
        key="complete"
        defaultCost={repair.agreedCost}
        isPending={isPending}
        onConfirm={(workDone, finalCost) => {
          onStatusChange("COMPLETED", "Ремонт выполнен", {
            workDone,
            finalCost: finalCost ? parseFloat(String(finalCost)) : undefined,
          })
        }}
      />
    )
  }

  if (status === "COMPLETED") {
    actions.push(
      <Button
        key="ready"
        disabled={isPending}
        onClick={() => onStatusChange("READY_FOR_PICKUP", "Готов к выдаче")}
      >
        <HandCoins className="size-4" />
        Готов к выдаче
      </Button>
    )
  }

  if (status === "READY_FOR_PICKUP") {
    if (remainingAmount > 0) {
      actions.push(
        <RepairPaymentDialog
          key="final-pay"
          title={`Оплата (${formatMoney(remainingAmount)} к оплате)`}
          defaultAmount={remainingAmount}
          isPending={isPending}
          onConfirm={onPayment}
        />
      )
    }
    actions.push(
      <Button
        key="deliver"
        disabled={isPending}
        onClick={() => onStatusChange("DELIVERED", "Устройство выдано клиенту")}
      >
        <PackageCheck className="size-4" />
        Выдать клиенту
      </Button>
    )
  }

  // Payment available for non-terminal, non-RECEIVED statuses
  if (!isTerminal && status !== "RECEIVED") {
    actions.push(
      <RepairPaymentDialog
        key="payment"
        title="Принять оплату"
        defaultAmount={remainingAmount > 0 ? remainingAmount : 0}
        isPending={isPending}
        onConfirm={onPayment}
      />
    )
  }

  // Edit available for non-terminal statuses
  if (!isTerminal) {
    actions.push(
      <EditRepairDialog
        key="edit"
        repair={repair}
        isPending={isPending}
        onConfirm={onUpdate}
      />
    )
  }

  // Cancel available for non-terminal statuses
  if (!isTerminal) {
    actions.push(
      <CancelRepairDialog
        key="cancel"
        isPending={isPending}
        onConfirm={(reason) => onStatusChange("CANCELLED", reason)}
      />
    )
  }

  return <>{actions}</>
}

// ---- Dialogs ----

function AssignMasterDialog({
  storeId,
  isPending,
  onConfirm,
}: {
  storeId: string
  isPending: boolean
  onConfirm: (masterId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [masterId, setMasterId] = useState("")
  const [masters, setMasters] = useState<Awaited<ReturnType<typeof getStoreMasters>>>([])
  const [loadingMasters, setLoadingMasters] = useState(false)

  async function loadMasters() {
    setLoadingMasters(true)
    try {
      const data = await getStoreMasters(storeId)
      setMasters(data)
    } catch {
      toast.error("Ошибка загрузки мастеров")
    } finally {
      setLoadingMasters(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) {
          loadMasters()
          setMasterId("")
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" disabled={isPending}>
            <Search className="size-4" />
            Начать диагностику
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Назначить мастера</DialogTitle>
          <DialogDescription>Выберите мастера для диагностики</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Мастер</Label>
            {loadingMasters ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Загрузка...
              </div>
            ) : (
              <Select value={masterId} onValueChange={(v) => setMasterId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите мастера" />
                </SelectTrigger>
                <SelectContent>
                  {masters.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={isPending || !masterId}
            onClick={() => {
              onConfirm(masterId)
              setOpen(false)
            }}
          >
            Назначить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DiagnosisDialog({
  isPending,
  onConfirm,
}: {
  isPending: boolean
  onConfirm: (diagnosis: string, estimatedCost?: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [diagnosis, setDiagnosis] = useState("")
  const [estimatedCost, setEstimatedCost] = useState("")

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setDiagnosis("")
          setEstimatedCost("")
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" disabled={isPending}>
            <CheckCircle className="size-4" />
            Завершить диагностику
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Результат диагностики</DialogTitle>
          <DialogDescription>Укажите диагноз и предварительную стоимость</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Диагноз *</Label>
            <Textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Описание неисправности..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Предварительная стоимость</Label>
            <Input
              type="number"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={isPending || !diagnosis.trim()}
            onClick={() => {
              const cost = estimatedCost ? parseFloat(estimatedCost) : undefined
              onConfirm(diagnosis.trim(), cost)
              setOpen(false)
            }}
          >
            Завершить диагностику
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApprovalDialog({
  defaultCost,
  isPending,
  onConfirm,
}: {
  defaultCost: number | null
  isPending: boolean
  onConfirm: (agreedCost: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [agreedCost, setAgreedCost] = useState(String(defaultCost ?? ""))

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) setAgreedCost(String(defaultCost ?? ""))
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" disabled={isPending}>
            <CheckCircle className="size-4" />
            Согласовать стоимость
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Согласование стоимости</DialogTitle>
          <DialogDescription>Укажите согласованную с клиентом стоимость</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Согласованная стоимость</Label>
            <Input
              type="number"
              value={agreedCost}
              onChange={(e) => setAgreedCost(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={isPending || !agreedCost}
            onClick={() => {
              const cost = parseFloat(agreedCost)
              if (isNaN(cost) || cost <= 0) {
                toast.error("Введите корректную сумму")
                return
              }
              onConfirm(cost)
              setOpen(false)
            }}
          >
            Согласовать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CompletionDialog({
  defaultCost,
  isPending,
  onConfirm,
}: {
  defaultCost: number | null
  isPending: boolean
  onConfirm: (workDone: string, finalCost?: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [workDone, setWorkDone] = useState("")
  const [finalCost, setFinalCost] = useState(String(defaultCost ?? ""))

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setWorkDone("")
          setFinalCost(String(defaultCost ?? ""))
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" disabled={isPending}>
            <CheckCircle className="size-4" />
            Завершить ремонт
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Завершение ремонта</DialogTitle>
          <DialogDescription>Опишите выполненные работы и итоговую стоимость</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Выполненные работы *</Label>
            <Textarea
              value={workDone}
              onChange={(e) => setWorkDone(e.target.value)}
              placeholder="Описание выполненных работ..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Итоговая стоимость</Label>
            <Input
              type="number"
              value={finalCost}
              onChange={(e) => setFinalCost(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={isPending || !workDone.trim()}
            onClick={() => {
              const cost = finalCost ? parseFloat(finalCost) : undefined
              onConfirm(workDone.trim(), cost)
              setOpen(false)
            }}
          >
            Завершить ремонт
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RepairPaymentDialog({
  title,
  defaultAmount,
  isPending,
  onConfirm,
}: {
  title: string
  defaultAmount: number
  isPending: boolean
  onConfirm: (method: PaymentMethod, amount: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>("CASH")
  const [amount, setAmount] = useState(String(defaultAmount))

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) {
          setMethod("CASH")
          setAmount(String(defaultAmount))
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" disabled={isPending}>
            <CreditCard className="size-4" />
            {title}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Укажите способ и сумму оплаты</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Способ оплаты</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Наличные</SelectItem>
                <SelectItem value="CARD">Карта</SelectItem>
                <SelectItem value="SBP">СБП</SelectItem>
                <SelectItem value="TRANSFER">Перевод</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Сумма</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => {
              const amt = parseFloat(amount)
              if (isNaN(amt) || amt <= 0) {
                toast.error("Введите корректную сумму")
                return
              }
              onConfirm(method, amt)
              setOpen(false)
            }}
          >
            Принять оплату
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditRepairDialog({
  repair,
  isPending,
  onConfirm,
}: {
  repair: RepairData
  isPending: boolean
  onConfirm: (data: any) => void
}) {
  const [open, setOpen] = useState(false)
  const [diagnosis, setDiagnosis] = useState(repair.diagnosis ?? "")
  const [estimatedCost, setEstimatedCost] = useState(
    repair.estimatedCost !== null ? String(repair.estimatedCost) : ""
  )
  const [agreedCost, setAgreedCost] = useState(
    repair.agreedCost !== null ? String(repair.agreedCost) : ""
  )
  const [workDone, setWorkDone] = useState(repair.workDone ?? "")
  const [warrantyDays, setWarrantyDays] = useState(String(repair.warrantyDays ?? 30))
  const [comment, setComment] = useState(repair.comment ?? "")

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) {
          setDiagnosis(repair.diagnosis ?? "")
          setEstimatedCost(repair.estimatedCost !== null ? String(repair.estimatedCost) : "")
          setAgreedCost(repair.agreedCost !== null ? String(repair.agreedCost) : "")
          setWorkDone(repair.workDone ?? "")
          setWarrantyDays(String(repair.warrantyDays ?? 30))
          setComment(repair.comment ?? "")
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" disabled={isPending}>
            <Pencil className="size-4" />
            Редактировать
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Редактирование ремонта</DialogTitle>
          <DialogDescription>Измените данные ремонта</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            <Label>Диагноз</Label>
            <Textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Предварительная стоимость</Label>
            <Input
              type="number"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Согласованная стоимость</Label>
            <Input
              type="number"
              value={agreedCost}
              onChange={(e) => setAgreedCost(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Выполненные работы</Label>
            <Textarea
              value={workDone}
              onChange={(e) => setWorkDone(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Гарантия (дней)</Label>
            <Input
              type="number"
              value={warrantyDays}
              onChange={(e) => setWarrantyDays(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Комментарий</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => {
              onConfirm({
                diagnosis: diagnosis || undefined,
                estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
                agreedCost: agreedCost ? parseFloat(agreedCost) : null,
                workDone: workDone || undefined,
                warrantyDays: warrantyDays ? parseInt(warrantyDays) : undefined,
                comment: comment || undefined,
              })
              setOpen(false)
            }}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelRepairDialog({
  isPending,
  onConfirm,
}: {
  isPending: boolean
  onConfirm: (reason: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" disabled={isPending} className="text-destructive hover:text-destructive">
            <Ban className="size-4" />
            Отменить
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Отмена ремонта</DialogTitle>
          <DialogDescription>Укажите причину отмены</DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Причина отмены..."
          rows={3}
        />
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={isPending || !reason.trim()}
            onClick={() => {
              onConfirm(reason.trim())
              setOpen(false)
            }}
          >
            Подтвердить отмену
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
