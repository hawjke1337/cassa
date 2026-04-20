"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getPendingSchemeDetail, approveMotivationScheme, rejectMotivationScheme } from "@/actions/motivation-schemes"
import { simulateSchemeComparison } from "@/actions/motivation-simulation"
import { FormulaDiff } from "@/components/motivation/formula-diff"
import type { MotivationFormula } from "@/lib/validations/motivation"

interface SchemeData {
  id: string
  name: string
  storeName: string | null
  createdByName: string
  formula: MotivationFormula
  parentFormula: MotivationFormula | null
}

interface SimulationRow {
  userId: string
  userName: string
  storeId: string
  storeName: string
  shiftsCount: number
  oldTotal: number
  newTotal: number
  diff: number
  diffPercent: number
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n)
}

function monthStart(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset, 1)
  return d.toISOString().slice(0, 10)
}

function monthEnd(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + 1 + offset, 0)
  return d.toISOString().slice(0, 10)
}

export function ApprovalDetailClient({ schemeId }: { schemeId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [scheme, setScheme] = useState<SchemeData | null>(null)
  const [simulation, setSimulation] = useState<SimulationRow[]>([])
  const [simulationLoading, setSimulationLoading] = useState(false)
  const [periodOffset, setPeriodOffset] = useState(0)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  useEffect(() => {
    async function load() {
      const data = await getPendingSchemeDetail(schemeId)
      setScheme({
        id: data.id,
        name: data.name,
        storeName: data.storeName ?? null,
        createdByName: data.createdByName,
        formula: data.formula as unknown as MotivationFormula,
        parentFormula: data.parentFormula
          ? (data.parentFormula as unknown as MotivationFormula)
          : null,
      })
    }
    load()
  }, [schemeId])

  useEffect(() => {
    if (!scheme?.parentFormula) return
    async function loadSimulation() {
      setSimulationLoading(true)
      try {
        const rows = await simulateSchemeComparison(
          schemeId,
          monthStart(periodOffset),
          monthEnd(periodOffset),
        )
        setSimulation(rows)
      } finally {
        setSimulationLoading(false)
      }
    }
    loadSimulation()
  }, [schemeId, scheme?.parentFormula, periodOffset])

  function handleApprove() {
    startTransition(async () => {
      await approveMotivationScheme(schemeId)
      router.push("/motivation/approvals")
    })
  }

  function handleReject() {
    startTransition(async () => {
      await rejectMotivationScheme(schemeId, rejectReason || undefined)
      setRejectDialogOpen(false)
      router.push("/motivation/approvals")
    })
  }

  if (!scheme) {
    return <div className="text-sm text-muted-foreground">Загрузка...</div>
  }

  const totalOld = simulation.reduce((s, r) => s + r.oldTotal, 0)
  const totalNew = simulation.reduce((s, r) => s + r.newTotal, 0)
  const totalDiff = totalNew - totalOld

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{scheme.name}</h1>
          <p className="text-sm text-muted-foreground">
            Автор: {scheme.createdByName} · Магазин: {scheme.storeName ?? "Общая"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleApprove} disabled={isPending}>
            <Check className="mr-2 size-4" />
            Подтвердить
          </Button>
          <Button
            variant="destructive"
            onClick={() => setRejectDialogOpen(true)}
            disabled={isPending}
          >
            <X className="mr-2 size-4" />
            Отклонить
          </Button>
        </div>
      </div>

      {/* Formula Diff */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          {scheme.parentFormula ? "Изменения формулы" : "Формула"}
        </h2>
        <FormulaDiff
          oldFormula={scheme.parentFormula}
          newFormula={scheme.formula}
        />
      </div>

      {/* Simulation */}
      {scheme.parentFormula && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Симуляция расчёта</h2>
            <div className="flex gap-2">
              <Button
                variant={periodOffset === 0 ? "secondary" : "outline"}
                size="sm"
                onClick={() => setPeriodOffset(0)}
              >
                Текущий месяц
              </Button>
              <Button
                variant={periodOffset === -1 ? "secondary" : "outline"}
                size="sm"
                onClick={() => setPeriodOffset(-1)}
              >
                Прошлый месяц
              </Button>
            </div>
          </div>

          {simulationLoading ? (
            <div className="text-sm text-muted-foreground">Расчёт...</div>
          ) : simulation.length === 0 ? (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">
              Нет сотрудников для сравнения
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead>Магазин</TableHead>
                    <TableHead className="text-right">Смены</TableHead>
                    <TableHead className="text-right">По старой</TableHead>
                    <TableHead className="text-right">По новой</TableHead>
                    <TableHead className="text-right">Разница</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {simulation.map((row) => (
                    <TableRow key={`${row.userId}-${row.storeId}`}>
                      <TableCell className="font-medium">{row.userName}</TableCell>
                      <TableCell>{row.storeName}</TableCell>
                      <TableCell className="text-right">{row.shiftsCount}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.oldTotal)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.newTotal)}</TableCell>
                      <TableCell className={`text-right font-medium ${row.diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {row.diff >= 0 ? "+" : ""}{formatMoney(row.diff)}
                      </TableCell>
                      <TableCell className={`text-right ${row.diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {row.diff >= 0 ? "+" : ""}{row.diffPercent.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Summary row */}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={3}>Итого</TableCell>
                    <TableCell className="text-right">{formatMoney(totalOld)}</TableCell>
                    <TableCell className="text-right">{formatMoney(totalNew)}</TableCell>
                    <TableCell className={`text-right ${totalDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {totalDiff >= 0 ? "+" : ""}{formatMoney(totalDiff)}
                    </TableCell>
                    <TableCell className="text-right">
                      {totalOld !== 0 ? `${((totalDiff / totalOld) * 100).toFixed(1)}%` : "—"}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отклонить схему</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Укажите причину отклонения (необязательно):
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Причина отклонения..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isPending}>
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
