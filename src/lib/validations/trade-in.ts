import { z } from "zod"

// ---- Customer ----

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Укажите ФИО"),
  phone: z.string().min(1, "Укажите телефон"),
  passportSeries: z.string().optional(),
  passportNumber: z.string().optional(),
  passportIssuedBy: z.string().optional(),
  passportIssuedAt: z.coerce.date().optional(),
  comment: z.string().optional(),
})

export const updateCustomerSchema = createCustomerSchema.partial()

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>

// ---- Trade-in ----

export const TRADE_IN_TYPES = ["TRADE_IN", "BUYBACK"] as const
export type TradeInType = (typeof TRADE_IN_TYPES)[number]

export const TRADE_IN_STATUSES = [
  "PENDING",
  "IN_STOCK",
  "IN_REPAIR",
  "SOLD",
  "WRITTEN_OFF",
] as const
export type TradeInStatus = (typeof TRADE_IN_STATUSES)[number]

export const TRADE_IN_TYPE_LABELS: Record<TradeInType, string> = {
  TRADE_IN: "Трейд-ин",
  BUYBACK: "Выкуп",
}

export const TRADE_IN_STATUS_LABELS: Record<TradeInStatus, string> = {
  PENDING: "Ожидает",
  IN_STOCK: "На складе",
  IN_REPAIR: "На ремонте",
  SOLD: "Продано",
  WRITTEN_OFF: "Списано",
}

export const DEVICE_TYPES = [
  "Смартфон",
  "Планшет",
  "Ноутбук",
  "Часы",
  "Наушники",
  "Другое",
] as const

export const createTradeInSchema = z.object({
  storeId: z.string().min(1),
  customerId: z.string().min(1, "Выберите клиента"),
  type: z.enum(TRADE_IN_TYPES),
  deviceType: z.string().min(1, "Укажите тип устройства"),
  deviceBrand: z.string().optional(),
  deviceModel: z.string().optional(),
  deviceImei: z.string().optional(),
  deviceCondition: z.string().min(1, "Опишите состояние"),
  // UX2-11: single "Цена выкупа" (agreedPrice). estimatedPrice оставлен optional для legacy.
  estimatedPrice: z.coerce.number().min(0, "Цена не может быть отрицательной").optional(),
  agreedPrice: z.coerce.number().min(0, "Цена не может быть отрицательной"),
  paymentMethod: z.string().optional(),
  saleNumber: z.string().optional(),
  comment: z.string().optional(),
  // INV-09: operator выбирает initial status (PENDING или IN_STOCK).
  initialStatus: z.enum(["PENDING", "IN_STOCK"]).default("PENDING"),
})

export type CreateTradeInInput = z.infer<typeof createTradeInSchema>
