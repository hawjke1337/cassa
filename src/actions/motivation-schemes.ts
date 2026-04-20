"use server"

import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import { motivationSchemeSchema } from "@/lib/validations/motivation"
import type { MotivationFormula } from "@/lib/validations/motivation"

export async function getMotivationSchemes(storeId?: string) {
  await requirePermission("motivation.schemes.manage")

  const schemes = await db.motivationScheme.findMany({
    where: storeId ? { OR: [{ storeId }, { storeId: null }] } : {},
    include: {
      store: { select: { id: true, name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return schemes.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    status: s.status,
    storeName: s.store?.name ?? "Все магазины",
    storeId: s.storeId,
    createdByName: `${s.createdBy.firstName} ${s.createdBy.lastName}`,
    assignmentCount: s._count.assignments,
    createdAt: s.createdAt.toISOString(),
  }))
}

export async function getMotivationScheme(id: string) {
  await requirePermission("motivation.schemes.manage")

  const scheme = await db.motivationScheme.findUnique({
    where: { id },
    include: {
      store: { select: { id: true, name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      approvedBy: { select: { firstName: true, lastName: true } },
      assignments: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          store: { select: { id: true, name: true } },
        },
        orderBy: { startDate: "desc" },
      },
    },
  })

  if (!scheme) throw new Error("Схема мотивации не найдена")

  return {
    id: scheme.id,
    name: scheme.name,
    description: scheme.description,
    formula: scheme.formula as unknown as MotivationFormula,
    status: scheme.status,
    storeId: scheme.storeId,
    storeName: scheme.store?.name ?? "Все магазины",
    createdByName: `${scheme.createdBy.firstName} ${scheme.createdBy.lastName}`,
    approvedByName: scheme.approvedBy
      ? `${scheme.approvedBy.firstName} ${scheme.approvedBy.lastName}`
      : null,
    version: scheme.version,
    approvedAt: scheme.approvedAt?.toISOString() ?? null,
    // BUILD-01: фильтруем assignments с удалённым user (onDelete: SetNull).
    assignments: scheme.assignments
      .filter((a) => a.user !== null)
      .map((a) => ({
        id: a.id,
        userId: a.user!.id,
        userName: `${a.user!.firstName} ${a.user!.lastName}`,
        storeId: a.store.id,
        storeName: a.store.name,
        startDate: a.startDate.toISOString(),
        endDate: a.endDate?.toISOString() ?? null,
      })),
    createdAt: scheme.createdAt.toISOString(),
  }
}

export async function createMotivationScheme(data: unknown) {
  await requirePermission("motivation.schemes.manage")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const validated = motivationSchemeSchema.parse(data)
  const isOwner = await checkPermission("motivation.schemes.approve")

  const scheme = await db.motivationScheme.create({
    data: {
      name: validated.name,
      description: validated.description,
      formula: validated.formula as unknown as Prisma.InputJsonValue,
      storeId: validated.storeId,
      createdById: session.user.id,
      status: isOwner ? "ACTIVE" : "PENDING_APPROVAL",
    },
  })

  return { id: scheme.id }
}

/**
 * DATA2-10: Validates motivation formula structure before save.
 */
function validateMotivationFormula(formula: unknown): void {
  if (formula === null || formula === undefined) {
    throw new Error("Формула мотивации не может быть пустой")
  }
  if (typeof formula !== "object" || Array.isArray(formula)) {
    throw new Error("Формула мотивации должна быть объектом JSON")
  }
}

/**
 * DATA2-11: Optimistic locking via version field.
 * expectedVersion must match current DB version, otherwise concurrent edit error.
 */
export async function updateMotivationScheme(id: string, data: unknown, expectedVersion?: number) {
  await requirePermission("motivation.schemes.manage")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const validated = motivationSchemeSchema.parse(data)

  // DATA2-10: Formula validation
  validateMotivationFormula(validated.formula)

  const isOwner = await checkPermission("motivation.schemes.approve")

  const existing = await db.motivationScheme.findUnique({ where: { id } })
  if (!existing) throw new Error("Схема мотивации не найдена")

  if (isOwner) {
    // Owner: direct edit with optimistic locking
    if (expectedVersion !== undefined) {
      const result = await db.motivationScheme.updateMany({
        where: { id, version: expectedVersion },
        data: {
          name: validated.name,
          description: validated.description,
          formula: validated.formula as unknown as Prisma.InputJsonValue,
          storeId: validated.storeId,
          version: { increment: 1 },
        },
      })

      if (result.count === 0) {
        throw new Error(
          "Данные были изменены другим пользователем. Обновите страницу и попробуйте снова.",
        )
      }
    } else {
      // Backward-compatible: no version check if not provided
      await db.motivationScheme.update({
        where: { id },
        data: {
          name: validated.name,
          description: validated.description,
          formula: validated.formula as unknown as Prisma.InputJsonValue,
          storeId: validated.storeId,
          version: { increment: 1 },
        },
      })
    }
    return { id }
  } else {
    // Director: create new version for approval, linked to original
    const newScheme = await db.motivationScheme.create({
      data: {
        name: validated.name,
        description: validated.description,
        formula: validated.formula as unknown as Prisma.InputJsonValue,
        storeId: validated.storeId,
        createdById: session.user.id,
        parentSchemeId: id,
        status: "PENDING_APPROVAL",
      },
    })
    return { id: newScheme.id, pendingApproval: true }
  }
}

export async function approveMotivationScheme(id: string) {
  await requirePermission("motivation.schemes.approve")

  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const scheme = await db.motivationScheme.findUnique({ where: { id } })
  if (!scheme) throw new Error("Схема не найдена")
  if (scheme.status !== "PENDING_APPROVAL") throw new Error("Схема не ожидает подтверждения")

  await db.$transaction(async (tx) => {
    await tx.motivationScheme.update({
      where: { id },
      data: {
        status: "ACTIVE",
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    })

    if (scheme.parentSchemeId) {
      await tx.motivationScheme.update({
        where: { id: scheme.parentSchemeId },
        data: { status: "ARCHIVED" },
      })

      await tx.motivationAssignment.updateMany({
        where: { schemeId: scheme.parentSchemeId },
        data: { schemeId: id },
      })
    }
  })
}

export async function rejectMotivationScheme(id: string, reason?: string) {
  await requirePermission("motivation.schemes.approve")

  const scheme = await db.motivationScheme.findUnique({ where: { id } })
  if (!scheme) throw new Error("Схема не найдена")
  if (scheme.status !== "PENDING_APPROVAL") throw new Error("Схема не ожидает подтверждения")

  await db.motivationScheme.update({
    where: { id },
    data: {
      status: "ARCHIVED",
      rejectionReason: reason || null,
    },
  })
}

export async function archiveMotivationScheme(id: string) {
  await requirePermission("motivation.schemes.manage")

  await db.motivationScheme.update({
    where: { id },
    data: { status: "ARCHIVED" },
  })
}

export async function getPendingSchemeCount() {
  const canApprove = await checkPermission("motivation.schemes.approve")
  if (!canApprove) return 0

  return db.motivationScheme.count({
    where: { status: "PENDING_APPROVAL" },
  })
}

export async function getPendingSchemes() {
  await requirePermission("motivation.schemes.approve")

  const schemes = await db.motivationScheme.findMany({
    where: { status: "PENDING_APPROVAL" },
    include: {
      store: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return schemes.map((s) => ({
    id: s.id,
    name: s.name,
    storeName: s.store?.name ?? null,
    createdByName: `${s.createdBy.firstName} ${s.createdBy.lastName}`,
    createdAt: s.createdAt.toISOString(),
  }))
}

export async function getPendingSchemeDetail(id: string) {
  await requirePermission("motivation.schemes.approve")

  const scheme = await db.motivationScheme.findUnique({
    where: { id },
    include: {
      store: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      parentScheme: { select: { formula: true } },
    },
  })

  if (!scheme) throw new Error("Схема не найдена")
  if (scheme.status !== "PENDING_APPROVAL") throw new Error("Схема не ожидает подтверждения")

  return {
    id: scheme.id,
    name: scheme.name,
    status: scheme.status,
    storeName: scheme.store?.name ?? null,
    createdByName: `${scheme.createdBy.firstName} ${scheme.createdBy.lastName}`,
    formula: scheme.formula,
    parentFormula: scheme.parentScheme?.formula ?? null,
    parentSchemeId: scheme.parentSchemeId,
  }
}
