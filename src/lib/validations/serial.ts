import { z } from "zod"
import { isValidImei } from "@/lib/imei-utils"
import { isValidPhone } from "@/lib/phone-utils"

export const imeiField = z
  .string()
  .refine((v) => !v || isValidImei(v), "Некорректный IMEI (15 цифр, проверка Луна)")
  .optional()
  .nullable()

export const serialNumberField = z
  .string()
  .min(1, "Серийный номер обязателен")
  .optional()
  .nullable()

export const serialUnitCreateSchema = z.object({
  productId: z.string().min(1),
  storeId: z.string().min(1),
  imei: imeiField,
  imei2: imeiField,
  serialNumber: serialNumberField,
  costPrice: z.coerce.number().min(0, "Себестоимость не может быть отрицательной"),
  warrantyDays: z.coerce.number().int().min(0).default(365),
})

export const serialUnitUpdateImeiSchema = z.object({
  id: z.string().min(1),
  imei: imeiField,
  imei2: imeiField,
  serialNumber: serialNumberField,
})

export const deviceRecordCreateSchema = z.object({
  imei: imeiField,
  imei2: imeiField,
  serialNumber: z.string().optional().nullable(),
  deviceType: z.string().min(1, "Тип устройства обязателен"),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
})

export const imeiSearchSchema = z.object({
  query: z.string().min(1, "Введите IMEI или серийный номер"),
})

export const phoneField = z
  .string()
  .refine((v) => !v || isValidPhone(v), "Невалидный номер телефона (формат: +7XXXXXXXXXX)")
  .optional()
  .nullable()

export type SerialUnitCreateData = z.infer<typeof serialUnitCreateSchema>
export type DeviceRecordCreateData = z.infer<typeof deviceRecordCreateSchema>
