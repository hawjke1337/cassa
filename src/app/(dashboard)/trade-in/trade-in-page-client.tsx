"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCurrentStore } from "@/hooks/use-current-store"
import { getTradeIns } from "@/actions/trade-in"
import {
  TRADE_IN_TYPE_LABELS,
  TRADE_IN_STATUS_LABELS,
  TRADE_IN_TYPES,
  TRADE_IN_STATUSES,
} from "@/lib/validations/trade-in"
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
import { Plus } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_STOCK: "bg-green-100 text-green-800",
  IN_REPAIR: "bg-blue-100 text-blue-800",
  SOLD: "bg-gray-100 text-gray-800",
  WRITTEN_OFF: "bg-red-100 text-red-800",
}

interface Props {
  canAccept: boolean
}

export function TradeInPageClient({ canAccept }: Props) {
  const router = useRouter()
  const { currentStoreId } = useCurrentStore()

  const [typeFilter, setTypeFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [tradeIns, setTradeIns] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadTradeIns = useCallback(async () => {
    if (!currentStoreId) return

    setLoading(true)
    try {
      const filters: any = {}
      if (typeFilter !== "ALL") filters.type = typeFilter
      if (statusFilter !== "ALL") filters.status = statusFilter
      if (dateFrom) filters.dateFrom = dateFrom
      if (dateTo) filters.dateTo = dateTo

      const data = await getTradeIns(currentStoreId, filters)
      setTradeIns(data)
    } finally {
      setLoading(false)
    }
  }, [currentStoreId, typeFilter, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    loadTradeIns()
  }, [loadTradeIns])

  if (!currentStoreId) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Выберите магазин</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Трейд-ин / Выкуп</h1>
        {canAccept && (
          <Button nativeButton={false} render={<Link href="/trade-in/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            Принять устройство
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val ?? "ALL")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все типы</SelectItem>
            {TRADE_IN_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TRADE_IN_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "ALL")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все статусы</SelectItem>
            {TRADE_IN_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TRADE_IN_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[160px]"
          placeholder="Дата от"
        />

        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[160px]"
          placeholder="Дата до"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Номер</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Устройство</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Приёмщик</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : tradeIns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Нет записей
                </TableCell>
              </TableRow>
            ) : (
              tradeIns.map((item) => {
                const device = [item.deviceType, item.deviceBrand, item.deviceModel]
                  .filter(Boolean)
                  .join(" ")

                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/trade-in/${item.id}`)}
                  >
                    <TableCell className="font-mono text-sm">
                      {item.number ?? item.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {new Date(item.createdAt).toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.type === "TRADE_IN" ? "outline" : "default"}>
                        {TRADE_IN_TYPE_LABELS[item.type as keyof typeof TRADE_IN_TYPE_LABELS] ?? item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.customer?.name ?? "—"}</TableCell>
                    <TableCell>{device || "—"}</TableCell>
                    <TableCell>
                      {item.agreedPrice != null
                        ? item.agreedPrice.toLocaleString("ru-RU") + " ₽"
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {TRADE_IN_STATUS_LABELS[item.status as keyof typeof TRADE_IN_STATUS_LABELS] ?? item.status}
                      </span>
                    </TableCell>
                    <TableCell>{item.acceptedBy?.name ?? "—"}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
