"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAudits, createAudit } from "@/actions/inventory"
import { AuditFilters } from "@/components/inventory/audit-filters"
import { useCurrentStore } from "@/hooks/use-current-store"
import { formatDate } from "@/lib/format"
import { toast } from "sonner"

interface AuditRow {
  id: string
  number: string
  status: string
  itemCount: number
  createdByName: string
  createdAt: string
  closedAt: string | null
}

export function AuditListClient() {
  const router = useRouter()
  const { currentStoreId } = useCurrentStore()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)

  const [audits, setAudits] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showDeleted, setShowDeleted] = useState(false)

  const loadAudits = useCallback(async () => {
    if (!currentStoreId) return
    setIsLoading(true)
    startTransition(async () => {
      try {
        const result = await getAudits(currentStoreId, { page, perPage: 20, showDeleted })
        setAudits(result.audits)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      } finally {
        setIsLoading(false)
      }
    })
  }, [currentStoreId, page, showDeleted])

  useEffect(() => {
    loadAudits()
  }, [loadAudits])

  async function handleCreate() {
    if (!currentStoreId) {
      toast.error("Выберите магазин")
      return
    }
    startTransition(async () => {
      try {
        const result = await createAudit(currentStoreId)
        toast.success(`Инвентаризация ${result.number} создана`)
        router.push(`/inventory/audit/${result.id}`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка")
      }
    })
  }

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин
      </div>
    )
  }

  function statusBadge(status: string) {
    switch (status) {
      case "DRAFT":
        return <Badge variant="outline">В работе</Badge>
      case "CONFIRMED":
        return (
          <Badge variant="default" className="bg-green-600">
            Закрыта
          </Badge>
        )
      case "CANCELLED":
        return <Badge variant="destructive">Отменена</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <AuditFilters showDeleted={showDeleted} onShowDeletedChange={setShowDeleted} />
        <Button size="sm" onClick={handleCreate} disabled={isPending}>
          <Plus className="size-4" />
          Новая инвентаризация
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Номер</TableHead>
              <TableHead>Дата создания</TableHead>
              <TableHead>Позиций</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Создал</TableHead>
              <TableHead>Дата закрытия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : audits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Нет инвентаризаций
                </TableCell>
              </TableRow>
            ) : (
              audits.map((a) => (
                <TableRow
                  key={a.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/inventory/audit/${a.id}`)}
                >
                  <TableCell className="font-mono text-sm">{a.number}</TableCell>
                  <TableCell>{formatDate(a.createdAt)}</TableCell>
                  <TableCell>{a.itemCount}</TableCell>
                  <TableCell>{statusBadge(a.status)}</TableCell>
                  <TableCell>{a.createdByName}</TableCell>
                  <TableCell>{a.closedAt ? formatDate(a.closedAt) : "\u2014"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Всего: {total}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isPending}
            >
              <ChevronLeft className="size-4" />
              Назад
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isPending}
            >
              Далее
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
