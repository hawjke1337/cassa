import type { ZoneElement, ElementType } from "@/lib/validations/price-labels"

export const SIZE_PRESETS = [
  { label: "50 × 30 мм", width: 50, height: 30 },
  { label: "60 × 40 мм", width: 60, height: 40 },
  { label: "70 × 50 мм", width: 70, height: 50 },
] as const

export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  productName: "Название товара",
  price: "Цена",
  oldPrice: "Старая цена",
  sku: "Артикул",
  barcode: "Штрих-код",
  storeName: "Название магазина",
  date: "Дата",
  logo: "Логотип",
  text: "Произвольный текст",
  qrCode: "QR-код",
}

export function createDefaultElement(type: ElementType): ZoneElement {
  return {
    id: crypto.randomUUID(),
    type,
    fontSize: type === "price" ? 24 : type === "productName" ? 14 : 10,
    fontWeight: type === "price" || type === "productName" ? "bold" : "normal",
    textAlign: "center",
    value: type === "text" ? "Текст" : type === "qrCode" ? "https://example.com" : undefined,
  }
}

export const DEFAULT_LAYOUT = {
  width: 60,
  height: 40,
  barcodeSource: "ean" as const,
  zones: {
    header: [],
    body: [
      createDefaultElement("productName"),
      createDefaultElement("price"),
    ],
    footer: [],
  },
}

// MM to PX conversion at 96 DPI
export const MM_TO_PX = 3.7795275591
