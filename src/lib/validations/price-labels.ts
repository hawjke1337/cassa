import { z } from "zod"

// ---- Element types ----

export const ELEMENT_TYPES = [
  "productName", "price", "oldPrice", "sku",
  "barcode", "storeName", "date", "logo", "text", "qrCode",
] as const

export type ElementType = typeof ELEMENT_TYPES[number]

// ---- Zod schemas ----

export const zoneElementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(ELEMENT_TYPES),
  fontSize: z.number().min(6).max(72),
  fontWeight: z.enum(["normal", "bold"]),
  textAlign: z.enum(["left", "center", "right"]),
  value: z.string().optional(),
})

export const layoutSchema = z.object({
  width: z.number().min(20).max(200),
  height: z.number().min(15).max(200),
  barcodeSource: z.enum(["ean", "sku"]),
  zones: z.object({
    header: z.array(zoneElementSchema),
    body: z.array(zoneElementSchema),
    footer: z.array(zoneElementSchema),
  }),
})

export const createTemplateSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1, "Название обязательно"),
  layout: layoutSchema,
})

export const updateTemplateSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  layout: layoutSchema,
})

// ---- TypeScript interfaces ----

export interface ZoneElement {
  id: string
  type: ElementType
  fontSize: number
  fontWeight: "normal" | "bold"
  textAlign: "left" | "center" | "right"
  value?: string
}

export interface PriceLabelLayout {
  width: number
  height: number
  barcodeSource: "ean" | "sku"
  zones: {
    header: ZoneElement[]
    body: ZoneElement[]
    footer: ZoneElement[]
  }
}

export interface PrintProductData {
  id: string
  name: string
  sku: string
  barcode: string | null
  sellPrice: number
  oldPrice: number | null
}

export interface PrintLabelsData {
  items: Array<{ productId: string; quantity: number }>
}
