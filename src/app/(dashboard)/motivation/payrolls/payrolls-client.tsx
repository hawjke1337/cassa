"use client"

import { Fragment, useEffect, useState, useTransition } from "react"
import { ChevronDown, ChevronRight, Trash2, Check, DollarSign, FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  getPayrolls,
  confirmPayroll,
  markPayrollPaid,
  deletePayroll,
  getPayrollPdfData,
} from "@/actions/motivation-payroll"
import { pdf } from "@react-pdf/renderer"
import { PayrollPdfDocument } from "@/components/motivation/payroll-pdf-document"
import { getUserStores } from "@/actions/stores"
import { useCurrentStore } from "@/hooks/use-current-store"
import { EarningsBreakdown } from "@/components/motivation/earnings-breakdown"
import type { EarningsResultForBreakdown } from "@/components/motivation/earnings-breakdown"

type Store = { id: string; name: string }

type PayrollRow = {
  id: string
  userName: string
  userId: string
  periodStart: string
  periodEnd: string
  shiftsCount: number
  dailyTotal: number
  commissions: number
  crossBonuses: number
  repairBonuses: number
  returns: number
  totalAmount: number
  isAdvance: boolean
  status: "DRAFT" | "CONFIRMED" | "PAID"
  breakdown: EarningsResultForBreakdown | null
  createdAt: string
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU")
}

function monthStartStr() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  CONFIRMED: "Подтверждён",
  PAID: "Выплачен",
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
}

export function PayrollsClient() {
  const { currentStoreId } = useCurrentStore()
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [dateFrom, setDateFrom] = useState(monthStartStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [employeeFilter, setEmployeeFilter] = useState("")
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getUserStores().then((s) => {
      setStores(s)
      if (currentStoreId) {
        setSelectedStoreId(currentStoreId)
      } else if (s.length > 0) {
        setSelectedStoreId(s[0].id)
      }
    })
  }, [currentStoreId])

  useEffect(() => {
    if (!selectedStoreId) return
    loadPayrolls()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, dateFrom, dateTo])

  async function loadPayrolls() {
    const data = await getPayrolls(selectedStoreId, dateFrom, dateTo)
    setPayrolls(data as unknown as PayrollRow[])
  }

  const filteredPayrolls = payrolls.filter((p) => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false
    if (employeeFilter && !p.userName.toLowerCase().includes(employeeFilter.toLowerCase())) return false
    return true
  })

  function handleConfirm(id: string) {
    startTransition(async () => {
      await confirmPayroll(id)
      await loadPayrolls()
    })
  }

  function handlePay(id: string) {
    startTransition(async () => {
      await markPayrollPaid(id)
      await loadPayrolls()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deletePayroll(id)
      await loadPayrolls()
    })
  }

  async function handleDownloadPdf(payrollId: string) {
    const data = await getPayrollPdfData(payrollId)
    const blob = await pdf(
      <PayrollPdfDocument
        userName={data.userName}
        storeName={data.storeName}
        periodStart={data.periodStart}
        periodEnd={data.periodEnd}
        isAdvance={data.isAdvance}
        breakdown={data.breakdown as any}
        advanceAmount={data.advanceAmount}
      />,
    ).toBlob()

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `payroll-${data.userName}-${data.periodStart.slice(0, 7)}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Расчётные листы</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Магазин</label>
          <Select value={selectedStoreId} onValueChange={(v) => setSelectedStoreId(v ?? "")}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Магазин" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">С</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">По</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Статус</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "ALL")}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все</SelectItem>
              <SelectItem value="DRAFT">Черновик</SelectItem>
              <SelectItem value="CONFIRMED">Подтверждён</SelectItem>
              <SelectItem value="PAID">Выплачен</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Сотрудник</label>
          <Input
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            placeholder="Поиск..."
            className="w-40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Период</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead className="text-right">Смены</TableHead>
              <TableHead className="text-right">Итого</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-32">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayrolls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-16 text-center text-muted-foreground">
                  Нет расчётных листов
                </TableCell>
              </TableRow>
            ) : (
              filteredPayrolls.map((p) => (
                <Fragment key={p.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  >
                    <TableCell>
                      {expandedId === p.id ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{p.userName}</TableCell>
                    <TableCell className="text-sm">
                      {formatDate(p.periodStart)} — {formatDate(p.periodEnd)}
                    </TableCell>
                    <TableCell>{p.isAdvance ? "Аванс" : "Расчёт"}</TableCell>
                    <TableCell className="text-right">{p.shiftsCount}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(p.totalAmount)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDownloadPdf(p.id)}
                          title="Скачать PDF"
                        >
                          <FileDown className="size-4" />
                        </Button>
                        {p.status === "DRAFT" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleConfirm(p.id)}
                              disabled={isPending}
                              title="Подтвердить"
                            >
                              <Check className="size-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger
                                render={
                                  <Button variant="ghost" size="icon-sm" title="Удалить">
                                    <Trash2 className="size-4 text-red-500" />
                                  </Button>
                                }
                              />
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Удалить расчётный лист?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Черновик будет удалён безвозвратно.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(p.id)}>
                                    Удалить
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        {p.status === "CONFIRMED" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handlePay(p.id)}
                            disabled={isPending}
                            title="Выплатить"
                          >
                            <DollarSign className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === p.id && p.breakdown && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/20 p-4">
                        <EarningsBreakdown earnings={p.breakdown} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
