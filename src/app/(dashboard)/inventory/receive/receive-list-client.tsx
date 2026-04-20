"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { ChevronLeft, ChevronRight, Printer } from "lucide-react"
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
import { getReceives, confirmReceive } from "@/actions/inventory"
import { useCurrentStore } from "@/hooks/use-current-store"
import { formatMoney, formatDate } from "@/lib/format"
import { toast } from "sonner"

interface ReceiveRow {
  id: string
  number: string
  status: string
  totalAmount: number
  comment: string | null
  itemCount: number
  receivedByName: string
  createdAt: string
  confirmedAt: string | null
}

export function ReceiveListClient() {
  const { currentStoreId } = useCurrentStore()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)

  const [receives, setReceives] = useState<ReceiveRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const loadReceives = useCallback(async () => {
    if (!currentStoreId) return
    setIsLoading(true)
    startTransition(async () => {
      try {
        const result = await getReceives(currentStoreId, { page, perPage: 20 })
        setReceives(result.receives)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      } finally {
        setIsLoading(false)
      }
    })
  }, [currentStoreId, page])

  useEffect(() => {
    loadReceives()
  }, [loadReceives])

  async function handleConfirm(receiveId: string) {
    try {
      await confirmReceive(receiveId)
      toast.success("Приход подтверждён. Остатки обновлены.")
      loadReceives()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка подтверждения")
    }
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
        return <Badge variant="outline">Черновик</Badge>
      case "CONFIRMED":
        return <Badge variant="default" className="bg-green-600">Подтверждён</Badge>
      case "CANCELLED":
        return <Badge variant="destructive">Отменён</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Номер</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Позиций</TableHead>
              <TableHead>Сумма</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Кто принял</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : receives.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Нет документов прихода
                </TableCell>
              </TableRow>
            ) : (
              receives.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.number}</TableCell>
                  <TableCell>{formatDate(r.createdAt)}</TableCell>
                  <TableCell>{r.itemCount}</TableCell>
                  <TableCell>{formatMoney(r.totalAmount)}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>{r.receivedByName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {r.status === "DRAFT" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfirm(r.id)}
                          disabled={isPending}
                        >
                          Подтвердить
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`/print/receive/${r.id}`, "_blank")}
                        title="Печать"
                      >
                        <Printer className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
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
