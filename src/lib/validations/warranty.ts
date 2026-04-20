import { z } from "zod"

export const warrantyClaimCreateSchema = z.object({
  type: z.enum(["SALE_WARRANTY", "REPAIR_WARRANTY"]),
  serialUnitId: z.string().optional().nullable(),
  repairId: z.string().optional().nullable(),
  deviceRecordId: z.string().optional().nullable(),
  storeId: z.string().min(1, "Магазин обязателен"),
  customerId: z.string().optional().nullable(),
  description: z.string().min(1, "Описание проблемы обязательно"),
})

export const warrantyClaimUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum([
    "RECEIVED", "DIAGNOSING", "SENT_TO_SUPPLIER",
    "REPLACEMENT_PENDING", "RESOLVED", "REJECTED",
  ]),
  resolution: z.string().optional().nullable(),
})

export type WarrantyClaimCreateData = z.infer<typeof warrantyClaimCreateSchema>
export type WarrantyClaimUpdateData = z.infer<typeof warrantyClaimUpdateSchema>
