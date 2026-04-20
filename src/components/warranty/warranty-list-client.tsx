"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getWarrantyClaims } from "@/actions/warranty-claims"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { useCurrentStore } from "@/hooks/use-current-store"
import { CreateWarrantyDialog } from "./create-warranty-dialog"

interface WarrantyListClientProps {
  canCreate: boolean
  canManage: boolean
}

type ClaimRow = Awaited<ReturnType<typeof getWarrantyClaims>>["claims"][number]

const TYPE_TABS = [
  { value: "ALL", label: "Все" },
  { value: "SALE_WARRANTY", label: "Продажи" },
  { value: "REPAIR_WARRANTY", label: "Ремонт" },
]

const STATUS_OPTIONS = [
  { value: "ALL", label: "Все статусы" },
  { value: "RECEIVED", label: "Принято" },
  { value: "DIAGNOSING", label: "Диагностика" },
  { value: "SENT_TO_SUPPLIER", label: "Отправлено поставщику" },
  { value: "REPLACEMENT_PENDING", label: "Ожидание замены" },
  { value: "RESOLVED", label: "Решено" },
  { value: "REJECTED", label: "Отклонено" },
]

export const WARRANTY_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Принято",
  DIAGNOSING: "Диагностика",
  SENT_TO_SUPPLIER: "У поставщика",
  REPLACEMENT_PENDING: "Ожидание замены",
  RESOLVED: "Решено",
  REJECTED: "Отклонено",
}

export const WARRANTY_STATUS_COLORS: Record<string, string> = {
  RECEIVED: "",
  DIAGNOSING: "border-blue-500 text-blue-600 dark:text-blue-400",
  SENT_TO_SUPPLIER: "border-amber-500 text-amber-600 dark:text-amber-400",
  REPLACEMENT_PENDING: "border-purple-500 text-purple-600 dark:text-purple-400",
  RESOLVED: "border-green-500 text-green-600 dark:text-green-400",
  REJECTED: "border-destructive text-destructive",
}

const WARRANTY_TYPE_LABELS: Record<string, string> = {
  SALE_WARRANTY: "Продажа",
  REPAIR_WARRANTY: "Ремонт",
}

export function WarrantyListClient({ canCreate, canManage: _canManage }: WarrantyListClientProps) {
  const router = useRouter()
  const { currentStoreId } = useCurrentStore()
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const loadClaims = useCallback(async () => {
    if (!currentStoreId) return
    setLoading(true)
    try {
      const result = await getWarrantyClaims(currentStoreId, {
        type: typeFilter !== "ALL" ? typeFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        page,
        perPage: 25,
      })
      setClaims(result.claims)
      setTotal(result.total)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ошибка загрузки обращений")
    } finally {
      setLoading(false)
    }
  }, [currentStoreId, typeFilter, statusFilter, page])

  useEffect(() => {
    loadClaims()
  }, [loadClaims])

  useEffect(() => {
    setPage(1)
  }, [typeFilter, statusFilter, currentStoreId])

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин для просмотра гарантийных обращений
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Tabs value={typeFilter} onValueChange={setTypeFilter}>
            <TabsList>
              {TYPE_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "ALL")}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Новое обращение
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : claims.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          {typeFilter !== "ALL" || statusFilter !== "ALL"
            ? "Обращения не найдены"
            : "Нет гарантийных обращений"}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Номер</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Устройство</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="hidden md:table-cell">Магазин</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((claim) => {
                const deviceLabel = [claim.deviceName, claim.imei]
                  .filter(Boolean)
                  .join(" / ") || claim.repairNumber || "—"

                return (
                  <TableRow
                    key={claim.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/warranty/${claim.id}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-mono text-xs">{claim.number}</div>
                        <div className="text-xs text-muted-foreground">
                          {WARRANTY_TYPE_LABELS[claim.type] ?? claim.type}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(claim.createdAt)}
                    </TableCell>
                    <TableCell>
                      {claim.customerName ? (
                        <div>
                          <div className="text-sm font-medium">{claim.customerName}</div>
                          {claim.customerPhone && (
                            <div className="text-xs text-muted-foreground">
                              {claim.customerPhone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] text-sm">
                      <div className="truncate">{deviceLabel}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={WARRANTY_STATUS_COLORS[claim.status] ?? ""}
                      >
                        {WARRANTY_STATUS_LABELS[claim.status] ?? claim.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {claim.storeName}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {total > 25 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Показано {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} из {total}
              </span>
              <div className="flex gap-2">
                <button
                  className="rounded px-2 py-1 hover:bg-muted disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Назад
                </button>
                <button
                  className="rounded px-2 py-1 hover:bg-muted disabled:opacity-50"
                  disabled={page * 25 >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Вперёд
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {canCreate && currentStoreId && (
        <CreateWarrantyDialog
          storeId={currentStoreId}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => {
            setCreateOpen(false)
            loadClaims()
          }}
        />
      )}
    </div>
  )
}
