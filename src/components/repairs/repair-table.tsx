"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getRepairs } from "@/actions/repairs"
import { formatMoney, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, Loader2 } from "lucide-react"
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS } from "./repair-status"
import type { RepairStatus } from "@/generated/prisma/client"

interface RepairTableProps {
  storeId: string
}

type RepairRow = Awaited<ReturnType<typeof getRepairs>>["repairs"][number]

const STATUS_TABS = [
  { value: "ALL", label: "Все" },
  { value: "ACTIVE", label: "В работе" },
  { value: "READY", label: "Готовы" },
  { value: "DONE", label: "Завершённые" },
]

export function RepairTable({ storeId }: RepairTableProps) {
  const router = useRouter()
  const [repairs, setRepairs] = useState<RepairRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [page, setPage] = useState(1)

  const loadRepairs = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getRepairs(storeId, {
        search: search || undefined,
        status: statusFilter,
        page,
        perPage: 25,
      })
      setRepairs(result.repairs)
      setTotal(result.total)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [storeId, search, statusFilter, page])

  useEffect(() => {
    loadRepairs()
  }, [loadRepairs])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по номеру, клиенту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : repairs.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          {search || statusFilter !== "ALL"
            ? "Ремонты не найдены"
            : "Нет ремонтов"}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Номер</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Устройство</TableHead>
                <TableHead className="hidden md:table-cell">Мастер</TableHead>
                <TableHead className="text-right">Стоимость</TableHead>
                <TableHead className="hidden sm:table-cell">Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repairs.map((repair) => {
                const deviceLabel =
                  [repair.deviceBrand, repair.deviceModel]
                    .filter(Boolean)
                    .join(" ") || repair.deviceType

                const costValue =
                  repair.finalCost ?? repair.agreedCost ?? repair.estimatedCost

                return (
                  <TableRow
                    key={repair.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/repairs/${repair.id}`)}
                  >
                    <TableCell className="font-mono text-xs">
                      {repair.number}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          REPAIR_STATUS_COLORS[repair.status as RepairStatus]
                        }
                      >
                        {REPAIR_STATUS_LABELS[repair.status as RepairStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{repair.clientName}</div>
                        <div className="text-xs text-muted-foreground">
                          {repair.clientPhone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm">
                      {deviceLabel}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {repair.masterName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {costValue != null ? formatMoney(costValue) : "—"}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {formatDate(repair.createdAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {total > 25 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Показано {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} из{" "}
                {total}
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
    </div>
  )
}
