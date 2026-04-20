"use client"

import { useState, useCallback, useEffect } from "react"
import { Input } from "@/components/ui/input"
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
import { useCurrentStore } from "@/hooks/use-current-store"
import { getFundReport } from "@/actions/reports"
import { formatMoney } from "@/lib/format"
import { Search } from "lucide-react"

type ReportRow = Awaited<ReturnType<typeof getFundReport>>[number]

export function FundsReportClient() {
  const { currentStoreId } = useCurrentStore()

  // Default to current month
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(firstDay)
  const [dateTo, setDateTo] = useState(lastDay)
  const [data, setData] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)

  const loadReport = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    try {
      const result = await getFundReport({
        storeId: currentStoreId || undefined,
        dateFrom,
        dateTo,
      })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [currentStoreId, dateFrom, dateTo])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const totalDeposits = data.reduce((s, r) => s + r.deposits, 0)
  const totalWithdrawals = data.reduce((s, r) => s + r.withdrawals, 0)
  const totalCount = data.reduce((s, r) => s + r.count, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">С</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">По</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>
        <Button onClick={loadReport} size="sm">
          <Search className="size-4" />
          Показать
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Фонд</TableHead>
              <TableHead>Магазин</TableHead>
              <TableHead className="text-right">Внесения</TableHead>
              <TableHead className="text-right">Выемки</TableHead>
              <TableHead className="text-right">Операций</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Нет данных за выбранный период
                </TableCell>
              </TableRow>
            ) : (
              <>
                {data.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.fundName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.storeName}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {row.deposits > 0 ? `+${formatMoney(row.deposits)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {row.withdrawals > 0 ? `−${formatMoney(row.withdrawals)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                  </TableRow>
                ))}
                {/* Totals */}
                <TableRow className="font-bold">
                  <TableCell colSpan={2}>Итого</TableCell>
                  <TableCell className="text-right text-green-600">
                    +{formatMoney(totalDeposits)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    −{formatMoney(totalWithdrawals)}
                  </TableCell>
                  <TableCell className="text-right">{totalCount}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
