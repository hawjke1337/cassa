import { z } from "zod"

export const openShiftSchema = z.object({
  storeId: z.string().min(1, "Магазин обязателен"),
  openingCash: z.coerce.number().min(0, "Сумма не может быть отрицательной"),
})

export const closeShiftSchema = z.object({
  shiftId: z.string().min(1),
  closingCash: z.coerce.number().min(0, "Сумма не может быть отрицательной"),
  note: z.string().optional(),
})

export const cashOperationSchema = z.object({
  shiftId: z.string().min(1),
  type: z.enum(["WITHDRAW", "DEPOSIT"]),
  amount: z.coerce.number().positive("Сумма должна быть положительной"),
  fundId: z.string().optional(),
  supplierId: z.string().optional(),
  reason: z.string().min(1, "Укажите причину"),
})

export const fundSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  storeId: z.string().optional(),
})
