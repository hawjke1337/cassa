"use server"

import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"
import { motivationAssignmentSchema } from "@/lib/validations/motivation"

export async function getAssignmentsForStore(storeId: string) {
  await requirePermission("motivation.schemes.assign")

  const assignments = await db.motivationAssignment.findMany({
    where: { storeId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      scheme: { select: { id: true, name: true, status: true } },
      store: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "desc" },
  })

  // BUILD-01: фильтруем assignments с удалённым user (onDelete: SetNull) —
  // удалённый сотрудник не должен попадать в расчёт мотивации.
  const withUser = assignments.filter((a) => a.user !== null)

  return withUser.map((a) => ({
    id: a.id,
    userId: a.user!.id,
    userName: `${a.user!.firstName} ${a.user!.lastName}`,
    schemeId: a.scheme.id,
    schemeName: a.scheme.name,
    schemeStatus: a.scheme.status,
    storeId: a.store.id,
    storeName: a.store.name,
    startDate: a.startDate.toISOString(),
    endDate: a.endDate?.toISOString() ?? null,
  }))
}

export async function createAssignment(data: unknown) {
  await requirePermission("motivation.schemes.assign")

  const validated = motivationAssignmentSchema.parse(data)

  // Check for overlapping assignments
  const overlapping = await db.motivationAssignment.findFirst({
    where: {
      userId: validated.userId,
      storeId: validated.storeId,
      startDate: { lte: validated.endDate ?? new Date("2099-12-31") },
      OR: [{ endDate: null }, { endDate: { gte: validated.startDate } }],
    },
  })

  if (overlapping) {
    throw new Error("У сотрудника уже есть назначенная схема на этот период")
  }

  // Verify scheme is ACTIVE
  const scheme = await db.motivationScheme.findUnique({
    where: { id: validated.schemeId },
  })
  if (!scheme || scheme.status !== "ACTIVE") {
    throw new Error("Можно назначать только активные схемы")
  }

  // DATA2-10: Store formula snapshot at time of assignment
  const assignment = await db.motivationAssignment.create({
    data: {
      schemeId: validated.schemeId,
      userId: validated.userId,
      storeId: validated.storeId,
      startDate: validated.startDate,
      endDate: validated.endDate,
      formulaSnapshot: scheme.formula as Prisma.InputJsonValue,
    },
  })

  return { id: assignment.id }
}

export async function endAssignment(id: string, endDate?: Date) {
  await requirePermission("motivation.schemes.assign")

  await db.motivationAssignment.update({
    where: { id },
    data: { endDate: endDate ?? new Date() },
  })
}

export async function deleteAssignment(id: string) {
  await requirePermission("motivation.schemes.assign")

  await db.motivationAssignment.delete({ where: { id } })
}

// Get employees available for assignment in a store
export async function getStoreEmployees(storeId: string) {
  await requirePermission("motivation.schemes.assign")

  const userStores = await db.userStore.findMany({
    where: { storeId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          motivationAssignments: {
            where: {
              storeId,
              OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
            },
            include: {
              scheme: { select: { name: true } },
            },
            take: 1,
          },
        },
      },
    },
  })

  // BUILD-01: фильтруем UserStore с удалённым user (onDelete: SetNull).
  const withUser = userStores.filter((us) => us.user !== null)

  return withUser.map((us) => ({
    id: us.user!.id,
    name: `${us.user!.firstName} ${us.user!.lastName}`,
    currentScheme: us.user!.motivationAssignments[0]?.scheme.name ?? null,
  }))
}
