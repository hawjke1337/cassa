import { z } from "zod"

export const createSaleItemSchema = z.object({
  productId: z.string().min(1, "productId обязателен"),
  quantity: z
    .number()
    .int("Количество должно быть целым числом")
    .positive("Количество должно быть > 0"),
  discount: z.number().min(0, "Скидка не может быть отрицательной"),
  serialUnitId: z.string().nullable().optional(),
})

export const createSaleSchema = z.object({
  storeId: z.string().min(1, "storeId обязателен"),
  items: z.array(createSaleItemSchema).min(1, "Добавьте товары"),
  payments: z
    .array(
      z.object({
        method: z.enum(["CASH", "CARD", "SBP", "TRANSFER", "CREDIT"]),
        amount: z.number().positive("Сумма оплаты должна быть > 0"),
      }),
    )
    .min(1, "Укажите способ оплаты"),
  comment: z.string().optional(),
  cashReceived: z.number().min(0).optional(),
  changeAmount: z.number().min(0).optional(),
  // UX2-06: Клиент генерирует UUID при каждом открытии PaymentDialog.
  // Server проверяет Sale с таким ключом и возвращает существующий,
  // защищая от дублей при refresh / double-submit / race condition.
  idempotencyKey: z.string().uuid("idempotencyKey должен быть UUID").optional(),
})

export type CreateSaleInput = z.infer<typeof createSaleSchema>
