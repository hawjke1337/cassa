"use client"

import { useState, useTransition, useCallback } from "react"
import { fetchAuditLogs, runAuditCleanup } from "@/actions/audit"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronRight, Trash2, X } from "lucide-react"
import { toast } from "sonner"

type AuditLogData = Awaited<ReturnType<typeof fetchAuditLogs>>

interface AuditLogTableProps {
  initialData: AuditLogData
}

const ACTION_OPTIONS = [
  { value: "CREATE", label: "Создание" },
  { value: "UPDATE", label: "Обновление" },
  { value: "DELETE", label: "Удаление" },
  { value: "ROLE_CHANGE", label: "Изменение роли" },
  { value: "PERMISSION_CHANGE", label: "Изменение прав" },
]

const ENTITY_OPTIONS = [
  "Sale",
  "User",
  "Role",
  "Customer",
  "Store",
  "CustomOrder",
  "Product",
  "StoreProduct",
  "Repair",
  "StockReceive",
  "StockTransfer",
  "InventoryAudit",
]

const ACTION_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CREATE: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
  ROLE_CHANGE: "outline",
  PERMISSION_CHANGE: "outline",
}

function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ChangesCell({ changes }: { changes: unknown }) {
  const [expanded, setExpanded] = useState(false)

  if (!changes || typeof changes !== "object") {
    return <span className="text-muted-foreground">-</span>
  }

  const entries = Object.entries(changes as Record<string, { old: unknown; new: unknown }>)
  if (entries.length === 0) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span className="ml-1 text-xs">{entries.length} изм.</span>
      </Button>
      {expanded && (
        <div className="mt-1 space-y-0.5 text-xs">
          {entries.map(([field, val]) => (
            <div key={field} className="font-mono">
              <span className="font-semibold">{field}:</span>{" "}
              <span className="text-red-500 line-through">{String(val.old ?? "null")}</span>
              {" -> "}
              <span className="text-green-600">{String(val.new ?? "null")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AuditLogTable({ initialData }: AuditLogTableProps) {
  const [data, setData] = useState<AuditLogData>(initialData)
  const [isPending, startTransition] = useTransition()

  const [filterAction, setFilterAction] = useState("")
  const [filterEntity, setFilterEntity] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")

  const [retentionDays, setRetentionDays] = useState(365)

  const applyFilters = useCallback(
    (
      overrides: {
        action?: string
        entity?: string
        dateFrom?: string
        dateTo?: string
        page?: number
      } = {},
    ) => {
      startTransition(async () => {
        const result = await fetchAuditLogs({
          action: overrides.action ?? (filterAction || undefined),
          entity: overrides.entity ?? (filterEntity || undefined),
          dateFrom: overrides.dateFrom ?? (filterDateFrom || undefined),
          dateTo: overrides.dateTo ?? (filterDateTo || undefined),
          page: overrides.page ?? 1,
        })
        setData(result)
      })
    },
    [filterAction, filterEntity, filterDateFrom, filterDateTo],
  )

  const clearFilters = () => {
    setFilterAction("")
    setFilterEntity("")
    setFilterDateFrom("")
    setFilterDateTo("")
    startTransition(async () => {
      const result = await fetchAuditLogs({})
      setData(result)
    })
  }

  const goToPage = (page: number) => {
    applyFilters({ page })
  }

  const handleCleanup = () => {
    startTransition(async () => {
      try {
        const result = await runAuditCleanup(retentionDays)
        toast.success(`Удалено ${result.deleted} записей`)
        applyFilters()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка очистки")
      }
    })
  }

  const hasFilters = filterAction || filterEntity || filterDateFrom || filterDateTo

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">Действие</Label>
              <Select
                value={filterAction}
                onValueChange={(v: string | null) => {
                  const val = v ?? ""
                  setFilterAction(val)
                  applyFilters({ action: val || undefined })
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Сущность</Label>
              <Select
                value={filterEntity}
                onValueChange={(v: string | null) => {
                  const val = v ?? ""
                  setFilterEntity(val)
                  applyFilters({ entity: val || undefined })
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_OPTIONS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Дата от</Label>
              <Input
                type="date"
                className="h-8"
                value={filterDateFrom}
                onChange={(e) => {
                  setFilterDateFrom(e.target.value)
                  applyFilters({ dateFrom: e.target.value })
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Дата до</Label>
              <Input
                type="date"
                className="h-8"
                value={filterDateTo}
                onChange={(e) => {
                  setFilterDateTo(e.target.value)
                  applyFilters({ dateTo: e.target.value })
                }}
              />
            </div>

            <div className="flex items-end">
              {hasFilters && (
                <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
                  <X className="mr-1 size-3" />
                  Сбросить
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Дата</TableHead>
              <TableHead className="w-[120px]">Действие</TableHead>
              <TableHead className="w-[100px]">Сущность</TableHead>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead className="w-[140px]">Пользователь</TableHead>
              <TableHead>Изменения</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {isPending ? "Загрузка..." : "Нет записей"}
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((item) => (
                <TableRow key={item.id} className={isPending ? "opacity-50" : ""}>
                  <TableCell className="text-xs">{formatDate(item.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={ACTION_BADGE_VARIANT[item.action] ?? "secondary"}>
                      {item.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{item.entity}</TableCell>
                  <TableCell className="text-xs font-mono">{item.entityId.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">
                    {item.user.firstName} {item.user.lastName}
                  </TableCell>
                  <TableCell>
                    <ChangesCell changes={item.changes} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Показано {(data.page - 1) * data.pageSize + 1}-
            {Math.min(data.page * data.pageSize, data.total)} из {data.total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1 || isPending}
              onClick={() => goToPage(data.page - 1)}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages || isPending}
              onClick={() => goToPage(data.page + 1)}
            >
              Вперёд
            </Button>
          </div>
        </div>
      )}

      {/* Retention cleanup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Очистка старых записей</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Период хранения (дней)</Label>
              <Input
                type="number"
                min={30}
                max={3650}
                className="h-8 w-32"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
              />
            </div>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="destructive" size="sm" className="h-8" disabled={isPending}>
                    <Trash2 className="mr-1 size-3" />
                    Очистить старые записи
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Очистить журнал аудита?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Будут удалены все записи старше {retentionDays} дней. Это действие необратимо.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCleanup}>Удалить</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
