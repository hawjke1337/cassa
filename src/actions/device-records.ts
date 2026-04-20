"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"
import { deviceRecordCreateSchema } from "@/lib/validations/serial"
import type { DeviceRecordCreateData } from "@/lib/validations/serial"

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]

/**
 * DATA2-12: Ищет существующий DeviceRecord по IMEI/IMEI2/serial.
 * Если найден — обновляет customerId и возвращает существующий.
 * Если не найден — создаёт новый.
 */
export async function findOrCreateDeviceRecordTx(
  tx: TxClient,
  data: DeviceRecordCreateData,
): Promise<string> {
  // Search existing by all identifiers for maximum dedup coverage
  const conditions = []
  if (data.imei) conditions.push({ imei: data.imei })
  if (data.imei2) conditions.push({ imei2: data.imei2 })
  if (data.serialNumber) conditions.push({ serialNumber: data.serialNumber })

  let existing = null
  if (conditions.length > 0) {
    existing = await tx.deviceRecord.findFirst({
      where: { OR: conditions },
    })
  }

  if (existing) {
    // Update customerId to current customer if changed
    if (data.customerId && existing.customerId !== data.customerId) {
      await tx.deviceRecord.update({
        where: { id: existing.id },
        data: { customerId: data.customerId },
      })
    }
    return existing.id
  }

  // Create new
  const record = await tx.deviceRecord.create({
    data: {
      imei: data.imei ?? null,
      imei2: data.imei2 ?? null,
      serialNumber: data.serialNumber ?? null,
      deviceType: data.deviceType,
      brand: data.brand ?? null,
      model: data.model ?? null,
      customerId: data.customerId ?? null,
    },
  })

  return record.id
}

export async function findOrCreateDeviceRecord(data: DeviceRecordCreateData) {
  await requirePermission("serial.view")

  const validated = deviceRecordCreateSchema.parse(data)

  const id = await db.$transaction(async (tx) => {
    return findOrCreateDeviceRecordTx(tx, validated)
  })

  return { id }
}
