import { z } from "zod"

export const productSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  sku: z.string().min(1, "Артикул обязателен"),
  barcode: z.string().optional().nullable(),
  categoryId: z.string().min(1, "Категория обязательна"),
  brandId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unit: z.string().default("шт"),
  sellPrice: z.coerce.number().positive("Цена должна быть положительной"),
  costPrice: z.coerce.number().min(0, "Себестоимость не может быть отрицательной"),
  minQty: z.coerce.number().int().min(0).default(0),
})

export interface ProductFormData {
  name: string
  sku: string
  barcode?: string | null
  categoryId: string
  brandId?: string | null
  description?: string | null
  unit: string
  sellPrice: number
  costPrice: number
  minQty: number
}

export const categorySchema = z
  .object({
    name: z.string().min(1, "Название обязательно"),
    parentId: z.string().nullable().optional(),
    isSerialized: z.boolean().default(false),
    identifierType: z.enum(["IMEI", "SN", "BOTH"]).nullable().optional(),
    // INV-01: admin force override of isSerialized flip when SerialUnit exists.
    forceOverride: z.boolean().optional(),
    forceReason: z.string().max(1000).optional(),
  })
  .refine((data) => !data.isSerialized || data.identifierType, {
    message: "Выберите тип идентификатора для сериализованной категории",
    path: ["identifierType"],
  })

export type CategoryFormData = z.infer<typeof categorySchema>

export const brandSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
})

export type BrandFormData = z.infer<typeof brandSchema>
