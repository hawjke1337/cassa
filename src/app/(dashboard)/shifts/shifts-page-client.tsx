"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useCurrentStore } from "@/hooks/use-current-store"
import { getShifts } from "@/actions/shifts"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import { formatMoney } from "@/lib/format"

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Открыта",
  CLOSED: "Закрыта",
  AUTO_CLOSED: "Не закрыта",
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
  AUTO_CLOSED: "bg-red-100 text-red-800",
}

type ShiftRow = Awaited<ReturnType<typeof getShifts>>["shifts"][number]

export function ShiftsPageClient() {
  const router = useRouter()
  const { currentStoreId } = useCurrentStore()

  const [statusFilter, setStatusFilter] = useState("ALL")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const loadShifts = useCallback(async () => {
    if (!currentStoreId) return
    setLoading(true)
    try {
      const data = await getShifts({
        storeId: currentStoreId,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
      })
      setShifts(data.shifts)
      setTotalPages(data.totalPages)
    } finally {
      setLoading(false)
    }
  }, [currentStoreId, statusFilter, dateFrom, dateTo, page])

  useEffect(() => {
    loadShifts()
  }, [loadShifts])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, dateFrom, dateTo])

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин
      </div>
    )
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    })

  const formatDateShort = (iso: string) =>
    new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "ALL")}>
            <SelectTrigger>
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все</SelectItem>
              <SelectItem value="OPEN">Открыта</SelectItem>
              <SelectItem value="CLOSED">Закрыта</SelectItem>
              <SelectItem value="AUTO_CLOSED">Не закрыта</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Номер</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Продавец</TableHead>
              <TableHead>Время</TableHead>
              <TableHead className="text-right">Наличные</TableHead>
              <TableHead className="text-right">Расхождение</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : shifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              shifts.map((shift) => (
                <TableRow
                  key={shift.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/shifts/${shift.id}`)}
                >
                  <TableCell className="font-mono text-sm">{shift.number}</TableCell>
                  <TableCell className="text-sm">{formatDateShort(shift.openedAt)}</TableCell>
                  <TableCell className="text-sm">{shift.openedByName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatTime(shift.openedAt)}
                    {shift.closedAt && ` → ${formatTime(shift.closedAt)}`}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatMoney(shift.openingCash)}
                    {shift.closingCash !== null && ` → ${formatMoney(shift.closingCash)}`}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {shift.discrepancy !== null ? (
                      <span className={shift.discrepancy === 0 ? "text-green-600" : "text-red-600"}>
                        {shift.discrepancy > 0 ? "+" : ""}
                        {formatMoney(shift.discrepancy)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[shift.status] ?? ""}>
                      {STATUS_LABELS[shift.status] ?? shift.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Далее
          </Button>
        </div>
      )}
    </div>
  )
}
