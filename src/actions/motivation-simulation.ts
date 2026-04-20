"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"
import { calculateEarningsWithFormula } from "@/actions/motivation-calculation"
import type { MotivationFormula } from "@/lib/validations/motivation"

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

export async function simulateSchemeComparison(
  schemeId: string,
  periodStart: string,
  periodEnd: string,
): Promise<SimulationRow[]> {
  await requirePermission("motivation.schemes.approve")

  const start = new Date(periodStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(periodEnd)
  end.setHours(23, 59, 59, 999)

  const scheme = await db.motivationScheme.findUnique({
    where: { id: schemeId },
    include: { parentScheme: true },
  })

  if (!scheme) throw new Error("Схема не найдена")
  if (scheme.status !== "PENDING_APPROVAL") throw new Error("Схема не ожидает подтверждения")
  if (!scheme.parentSchemeId || !scheme.parentScheme) return []

  const newFormula = scheme.formula as unknown as MotivationFormula
  const oldFormula = scheme.parentScheme.formula as unknown as MotivationFormula

  const assignments = await db.motivationAssignment.findMany({
    where: {
      schemeId: scheme.parentSchemeId,
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      store: { select: { id: true, name: true } },
    },
  })

  // BUILD-01: отбрасываем assignments с удалённым user (userId=null через onDelete: SetNull) —
  // для удалённого сотрудника сравнение старой/новой схемы неприменимо.
  const withUser = assignments.filter((a) => a.user !== null && a.userId !== null)

  if (withUser.length === 0) return []

  const payrolls = await db.payroll.findMany({
    where: {
      userId: { in: withUser.map((a) => a.userId!) },
      storeId: { in: withUser.map((a) => a.storeId) },
      periodStart: { lte: end },
      periodEnd: { gte: start },
    },
    select: { userId: true, storeId: true, shiftsCount: true },
  })
  const shiftsMap = new Map(payrolls.map((p) => [`${p.userId}-${p.storeId}`, p.shiftsCount]))

  const results = await Promise.all(
    withUser.map(async (assignment) => {
      const shiftsCount = shiftsMap.get(`${assignment.userId}-${assignment.storeId}`) ?? 0

      const [oldEarnings, newEarnings] = await Promise.all([
        calculateEarningsWithFormula(
          assignment.userId!,
          assignment.storeId,
          start,
          end,
          shiftsCount,
          oldFormula,
        ),
        calculateEarningsWithFormula(
          assignment.userId!,
          assignment.storeId,
          start,
          end,
          shiftsCount,
          newFormula,
        ),
      ])

      const oldTotal = oldEarnings.totals.total
      const newTotal = newEarnings.totals.total
      const diff = newTotal - oldTotal
      const diffPercent = oldTotal !== 0 ? (diff / oldTotal) * 100 : 0

      return {
        userId: assignment.user!.id,
        userName: `${assignment.user!.firstName} ${assignment.user!.lastName}`,
        storeId: assignment.store.id,
        storeName: assignment.store.name,
        shiftsCount,
        oldTotal,
        newTotal,
        diff,
        diffPercent,
      }
    }),
  )

  return results
}
