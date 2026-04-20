"use client"

import { useState, useCallback, useEffect } from "react"
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
import { useCurrentStore } from "@/hooks/use-current-store"
import { getSupplierDebtsReport } from "@/actions/reports"
import { getSuppliersList } from "@/actions/suppliers"
import { formatMoney, formatDate } from "@/lib/format"
import { DebtPaymentDialog } from "@/components/suppliers/debt-payment-dialog"
import { Search } from "lucide-react"

type ReportData = Awaited<ReturnType<typeof getSupplierDebtsReport>>
type DebtRow = ReportData["debts"][number]
type Supplier = { id: string; name: string }

export function SupplierDebtsClient() {
  const { currentStoreId } = useCurrentStore()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(firstDay)
  const [dateTo, setDateTo] = useState(lastDay)
  const [supplierId, setSupplierId] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getSuppliersList().then((list) =>
      setSuppliers(list.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))),
    )
  }, [])

  const loadReport = useCallback(async () => {
    if (!currentStoreId || !dateFrom || !dateTo) return
    setLoading(true)
    try {
      const result = await getSupplierDebtsReport({
        storeId: currentStoreId,
        supplierId: supplierId !== "all" ? supplierId : undefined,
        isPaid: statusFilter === "paid" ? true : statusFilter === "unpaid" ? false : undefined,
        dateFrom,
        dateTo,
      })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [currentStoreId, dateFrom, dateTo, supplierId, statusFilter])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  function getTotalPaid(debt: DebtRow): number {
    return debt.totalPaid
  }

  function getRemaining(debt: DebtRow): number {
    return debt.amount - getTotalPaid(debt)
  }

  function getStatusBadge(debt: DebtRow) {
    if (debt.isPaid) {
      return (
        <Badge variant="outline" className="border-green-500 text-green-600">
          Оплачен
        </Badge>
      )
    }
    const paid = getTotalPaid(debt)
    if (paid > 0) {
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
          Частично
        </Badge>
      )
    }
    return <Badge variant="destructive">Не оплачен</Badge>
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-red-50 p-4 dark:bg-red-950/20">
            <p className="text-sm text-muted-foreground">Общая задолженность</p>
            <p className="text-2xl font-bold text-red-600">{formatMoney(data.totalUnpaid)}</p>
            <p className="text-xs text-muted-foreground">{data.unpaidCount} неоплаченных</p>
          </div>
          <div className="rounded-lg border bg-green-50 p-4 dark:bg-green-950/20">
            <p className="text-sm text-muted-foreground">Оплачено за период</p>
            <p className="text-2xl font-bold text-green-600">{formatMoney(data.totalPaid)}</p>
            <p className="text-xs text-muted-foreground">{data.paidCount} оплаченных</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Поставщик</label>
          <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "all")}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Все поставщики" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все поставщики</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Статус</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="unpaid">Не оплачены</SelectItem>
              <SelectItem value="paid">Оплачены</SelectItem>
            </SelectContent>
          </Select>
        </div>
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

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Поставщик</TableHead>
              <TableHead>Заказ #</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead className="text-right">Оплачено</TableHead>
              <TableHead className="text-right">Остаток</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действие</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !data || data.debts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Нет данных за выбранный период
                </TableCell>
              </TableRow>
            ) : (
              data.debts.map((debt) => (
                <TableRow key={debt.id}>
                  <TableCell className="font-medium">{debt.supplierName}</TableCell>
                  <TableCell className="text-muted-foreground">{debt.orderNumber}</TableCell>
                  <TableCell className="text-right">{formatMoney(debt.amount)}</TableCell>
                  <TableCell className="text-right">{formatMoney(getTotalPaid(debt))}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(getRemaining(debt))}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(debt.createdAt)}
                  </TableCell>
                  <TableCell>{getStatusBadge(debt)}</TableCell>
                  <TableCell className="text-right">
                    {!debt.isPaid && (
                      <DebtPaymentDialog
                        debtId={debt.id}
                        debtAmount={String(debt.amount)}
                        totalPaid={String(getTotalPaid(debt))}
                        orderNumber={debt.orderNumber}
                        onSuccess={loadReport}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
