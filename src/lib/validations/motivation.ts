import { z } from "zod"

// --- Motivation Group ---

export const motivationGroupSchema = z.object({
  code: z.string().min(1, "Код обязателен").max(20, "Код слишком длинный"),
  name: z.string().min(1, "Название обязательно"),
  description: z.string().optional().nullable(),
})

export type MotivationGroupFormData = z.infer<typeof motivationGroupSchema>

// --- Commission Rule ---

export const commissionBasisSchema = z.enum(["PROFIT", "RETAIL_PRICE"])

export type CommissionBasis = z.infer<typeof commissionBasisSchema>

export const commissionTypeSchema = z.enum(["PERCENT", "FIXED"])

export type CommissionType = z.infer<typeof commissionTypeSchema>

export const commissionRuleSchema = z.object({
  groupId: z.string().optional(),
  type: commissionTypeSchema.default("PERCENT"),
  rate: z.coerce.number().min(0, "Значение не может быть отрицательным"),
  basis: commissionBasisSchema,
}).refine(
  (data) => {
    if (data.type === "PERCENT") return data.rate <= 1
    if (data.type === "FIXED") return data.rate <= 100000
    return true
  },
  {
    message: "Для процента максимум 1 (100%), для фиксированной суммы максимум 100 000",
    path: ["rate"],
  },
)

export type CommissionRule = z.infer<typeof commissionRuleSchema>

// --- Cross-Sell Bonus ---

export const crossSellBonusSchema = z.object({
  minItems: z.coerce.number().int().min(2, "Минимум 2 позиции"),
  bonus: z.coerce.number().positive("Бонус должен быть положительным"),
})

export type CrossSellBonus = z.infer<typeof crossSellBonusSchema>

// --- Motivation Formula (JSON stored in scheme) ---

export const motivationFormulaSchema = z.object({
  dailyRate: z.coerce.number().min(0, "Ставка не может быть отрицательной"),
  commissionRules: z.array(commissionRuleSchema),
  defaultCommission: commissionRuleSchema,
  crossSellBonuses: z.array(crossSellBonusSchema),
  repairBonus: z.coerce.number().min(0, "Бонус не может быть отрицательным"),
})

export type MotivationFormula = z.infer<typeof motivationFormulaSchema>

// --- Motivation Scheme ---

export const motivationSchemeSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  description: z.string().optional().nullable(),
  storeId: z.string().optional().nullable(),
  formula: motivationFormulaSchema,
})

export type MotivationSchemeFormData = z.infer<typeof motivationSchemeSchema>

// --- Motivation Assignment ---

export const motivationAssignmentSchema = z.object({
  schemeId: z.string().min(1, "Схема обязательна"),
  userId: z.string().min(1, "Сотрудник обязателен"),
  storeId: z.string().min(1, "Магазин обязателен"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
})

export type MotivationAssignmentFormData = z.infer<typeof motivationAssignmentSchema>

// --- Payroll ---

export const generatePayrollSchema = z.object({
  userId: z.string().min(1, "Сотрудник обязателен"),
  storeId: z.string().min(1, "Магазин обязателен"),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  shiftsCount: z.coerce.number().int().min(0, "Количество смен не может быть отрицательным"),
  isAdvance: z.boolean().default(false),
})

export type GeneratePayrollData = z.infer<typeof generatePayrollSchema>

// --- Constants ---

export const COMMISSION_BASIS_LABELS: Record<CommissionBasis, string> = {
  PROFIT: "От чистой прибыли",
  RETAIL_PRICE: "От розничной цены",
}

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  PERCENT: "Процент",
  FIXED: "Фикс. сумма",
}

export const SCHEME_STATUS_LABELS = {
  ACTIVE: "Активна",
  PENDING_APPROVAL: "Ожидает подтверждения",
  ARCHIVED: "В архиве",
} as const

export const PAYROLL_STATUS_LABELS = {
  DRAFT: "Черновик",
  CONFIRMED: "Подтверждён",
  PAID: "Выплачен",
} as const
