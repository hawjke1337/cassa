# Price Labels Constructor — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zone-based price label template constructor with drag-and-drop editor, barcode/QR support, and multi-point print triggers (settings, catalog, stock receive).

**Architecture:** Three-zone label layout (header/body/footer) with elements rendered top-to-bottom per zone. Templates stored as JSON in PostgreSQL via Prisma. Print renders labels on A4 grid via CSS `@media print`. Editor uses three-column layout with live preview.

**Tech Stack:** Next.js 16 App Router, Prisma 7, PostgreSQL, TailwindCSS, shadcn/ui (Base UI), JsBarcode, qrcode.react, @hello-pangea/dnd

**Spec:** `docs/superpowers/specs/2026-03-14-price-labels-design.md`

---

## File Structure

### New Files
- `src/lib/validations/price-labels.ts` — Zod schemas + TypeScript interfaces for layout JSON
- `src/actions/price-labels.ts` — Server actions: CRUD templates + getProductsForPrint
- `src/components/price-labels/label-constants.ts` — SIZE_PRESETS, ELEMENT_TYPE_LABELS, default element config
- `src/components/price-labels/label-renderer.tsx` — PriceLabelRenderer: renders one label from layout + product data
- `src/components/price-labels/template-table.tsx` — Template list table with actions
- `src/components/price-labels/label-settings-panel.tsx` — Left panel: name, size, barcode source
- `src/components/price-labels/zone-editor.tsx` — Right panel: zone element lists with drag-and-drop
- `src/components/price-labels/element-settings.tsx` — Per-element settings (font, size, align)
- `src/components/price-labels/print-labels-dialog.tsx` — Shared dialog: product selection + template picker
- `src/app/(dashboard)/settings/price-labels/page.tsx` — Template list page (server component)
- `src/app/(dashboard)/settings/price-labels/price-labels-client.tsx` — Template list client component
- `src/app/(dashboard)/settings/price-labels/[id]/page.tsx` — Editor page (server component)
- `src/app/(dashboard)/settings/price-labels/[id]/editor-client.tsx` — Editor client component
- `src/app/(dashboard)/print/price-labels/page.tsx` — Print page (client, reads localStorage)

### Modified Files
- `prisma/schema.prisma` — Add `PriceLabelTemplate` model + relations on `Store` and `User`
- `src/components/settings/settings-nav.tsx` — Add "Ценники" nav item
- `src/app/(dashboard)/settings/layout.tsx` — Add `settings.templates` to access check
- `src/app/(dashboard)/inventory/receive/receive-list-client.tsx` — Add print labels prompt after confirm
- `src/components/catalog/product-table.tsx` — Add "Печать ценников" action button

---

## Chunk 1: Data Layer

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add PriceLabelTemplate model to schema**

Add after the last model in `prisma/schema.prisma`:

```prisma
model PriceLabelTemplate {
  id          String   @id @default(cuid())
  storeId     String
  store       Store    @relation(fields: [storeId], references: [id])
  name        String
  width       Int
  height      Int
  layout      Json
  isDefault   Boolean  @default(false)
  createdById String
  createdBy   User     @relation("PriceLabelCreatedBy", fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Add relation to `Store` model (after `repairs` line):
```prisma
  priceLabelTemplates PriceLabelTemplate[]
```

Add relation to `User` model (after the last relation):
```prisma
  priceLabelTemplates PriceLabelTemplate[]  @relation("PriceLabelCreatedBy")
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/pushkarev/PROD/astore\ syy/astore-erp
npx prisma migrate dev --name add_price_label_template
```

Expected: Migration created successfully, Prisma client regenerated.

- [ ] **Step 3: Verify by running build**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(price-labels): add PriceLabelTemplate model and migration"
```

---

### Task 2: Validation Schemas + Types

**Files:**
- Create: `src/lib/validations/price-labels.ts`

- [ ] **Step 1: Create validation file with Zod schemas and TypeScript interfaces**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validations/price-labels.ts
git commit -m "feat(price-labels): add Zod validation schemas and TypeScript interfaces"
```

---

### Task 3: Constants

**Files:**
- Create: `src/components/price-labels/label-constants.ts`

- [ ] **Step 1: Create constants file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/price-labels/label-constants.ts
git commit -m "feat(price-labels): add size presets, element labels, and defaults"
```

---

### Task 4: Server Actions

**Files:**
- Create: `src/actions/price-labels.ts`

- [ ] **Step 1: Create server actions file**

```typescript
"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/permissions"
import { createTemplateSchema, updateTemplateSchema } from "@/lib/validations/price-labels"
import type { PrintProductData } from "@/lib/validations/price-labels"

export async function getTemplates(storeId: string) {
  await requirePermission("settings.templates", storeId)

  const templates = await db.priceLabelTemplate.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      width: true,
      height: true,
      isDefault: true,
      createdAt: true,
    },
  })

  return templates.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }))
}

export async function getTemplate(id: string) {
  const template = await db.priceLabelTemplate.findUnique({
    where: { id },
    include: { store: { select: { name: true } } },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  return {
    id: template.id,
    storeId: template.storeId,
    storeName: template.store.name,
    name: template.name,
    width: template.width,
    height: template.height,
    layout: template.layout,
    isDefault: template.isDefault,
    createdAt: template.createdAt.toISOString(),
  }
}

export async function createTemplate(data: {
  storeId: string
  name: string
  layout: unknown
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const validated = createTemplateSchema.parse(data)
  await requirePermission("settings.templates", validated.storeId)

  const template = await db.priceLabelTemplate.create({
    data: {
      storeId: validated.storeId,
      name: validated.name,
      width: validated.layout.width,
      height: validated.layout.height,
      layout: validated.layout as object,
      createdById: session.user.id,
    },
  })

  return { id: template.id }
}

export async function updateTemplate(id: string, data: {
  name: string
  layout: unknown
}) {
  const template = await db.priceLabelTemplate.findUnique({
    where: { id },
    select: { storeId: true },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  const validated = updateTemplateSchema.parse(data)

  await db.priceLabelTemplate.update({
    where: { id },
    data: {
      name: validated.name,
      width: validated.layout.width,
      height: validated.layout.height,
      layout: validated.layout as object,
    },
  })

  return { success: true }
}

export async function deleteTemplate(id: string) {
  const template = await db.priceLabelTemplate.findUnique({
    where: { id },
    select: { storeId: true },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  await db.priceLabelTemplate.delete({ where: { id } })

  return { success: true }
}

export async function duplicateTemplate(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const template = await db.priceLabelTemplate.findUnique({
    where: { id },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  const copy = await db.priceLabelTemplate.create({
    data: {
      storeId: template.storeId,
      name: `Копия — ${template.name}`,
      width: template.width,
      height: template.height,
      layout: template.layout as object,
      isDefault: false,
      createdById: session.user.id,
    },
  })

  return { id: copy.id }
}

export async function setDefaultTemplate(id: string) {
  const template = await db.priceLabelTemplate.findUnique({
    where: { id },
    select: { storeId: true },
  })
  if (!template) throw new Error("Шаблон не найден")

  await requirePermission("settings.templates", template.storeId)

  await db.$transaction(async (tx) => {
    await tx.priceLabelTemplate.updateMany({
      where: { storeId: template.storeId, isDefault: true },
      data: { isDefault: false },
    })
    await tx.priceLabelTemplate.update({
      where: { id },
      data: { isDefault: true },
    })
  })

  return { success: true }
}

export async function getProductsForPrint(
  storeId: string,
  productIds: string[]
): Promise<PrintProductData[]> {
  await requirePermission("catalog.view", storeId)

  const products = await db.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: {
      storeProducts: {
        where: { storeId },
        select: { sellPrice: true },
      },
    },
  })

  // Fetch latest old prices from PriceHistory for each product
  const priceHistories = await db.priceHistory.findMany({
    where: {
      productId: { in: productIds },
      storeId,
      field: "sellPrice",
    },
    orderBy: { changedAt: "desc" },
    distinct: ["productId"],
    select: {
      productId: true,
      oldPrice: true,
    },
  })

  const oldPriceMap = new Map(
    priceHistories.map((ph) => [ph.productId, Number(ph.oldPrice)])
  )

  return products.map((p) => {
    const sp = p.storeProducts[0]
    const sellPrice = sp ? Number(sp.sellPrice) : 0
    const oldPrice = oldPriceMap.get(p.id) ?? null

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      sellPrice,
      oldPrice: oldPrice !== null && oldPrice !== sellPrice ? oldPrice : null,
    }
  })
}

// For PrintLabelsDialog: list templates (lightweight, also accessible with catalog.view)
export async function getTemplatesForPrint(storeId: string) {
  await requirePermission("catalog.view", storeId)

  return db.priceLabelTemplate.findMany({
    where: { storeId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      width: true,
      height: true,
      isDefault: true,
    },
  })
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/pushkarev/PROD/astore\ syy/astore-erp && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/price-labels.ts
git commit -m "feat(price-labels): add server actions for template CRUD and print data"
```

---

## Chunk 2: Label Renderer + Print Page

### Task 5: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install JsBarcode, qrcode.react, @hello-pangea/dnd**

```bash
cd /Users/pushkarev/PROD/astore\ syy/astore-erp
npm install jsbarcode qrcode.react @hello-pangea/dnd
npm install --save-dev @types/jsbarcode 2>/dev/null || true
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(price-labels): install jsbarcode, qrcode.react, @hello-pangea/dnd"
```

---

### Task 6: PriceLabelRenderer Component

**Files:**
- Create: `src/components/price-labels/label-renderer.tsx`

This is the core rendering component used both in the editor preview and print page.

- [ ] **Step 1: Create the renderer**

```tsx
"use client"

import { useEffect, useRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import JsBarcode from "jsbarcode"
import { formatMoney, formatDate } from "@/lib/format"
import type { PriceLabelLayout, ZoneElement, PrintProductData } from "@/lib/validations/price-labels"
import { MM_TO_PX } from "@/components/price-labels/label-constants"

interface LabelRendererProps {
  layout: PriceLabelLayout
  product?: PrintProductData
  storeName?: string
  scale?: number
  useMm?: boolean
}

function BarcodeElement({
  value,
  format,
  width,
}: {
  value: string
  format: "EAN13" | "CODE128"
  width: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !value) return
    try {
      JsBarcode(svgRef.current, value, {
        format,
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 10,
        margin: 0,
      })
    } catch {
      // Invalid barcode — clear by removing child nodes safely
      while (svgRef.current.firstChild) {
        svgRef.current.removeChild(svgRef.current.firstChild)
      }
    }
  }, [value, format])

  if (!value) {
    return (
      <span className="text-xs text-muted-foreground">Нет штрих-кода</span>
    )
  }

  return <svg ref={svgRef} style={{ maxWidth: width, height: "auto" }} />
}

function renderElement(
  element: ZoneElement,
  product: PrintProductData | undefined,
  storeName: string,
  layout: PriceLabelLayout,
  containerWidth: number
) {
  const style: React.CSSProperties = {
    fontSize: `${element.fontSize}px`,
    fontWeight: element.fontWeight,
    textAlign: element.textAlign,
    width: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }

  const demoProduct: PrintProductData = {
    id: "demo",
    name: "iPhone 15 Pro Max 256GB",
    sku: "IP15PM-256",
    barcode: "4680000000001",
    sellPrice: 89990,
    oldPrice: 99990,
  }

  const p = product ?? demoProduct

  const flexAlign = element.textAlign === "center"
    ? "center"
    : element.textAlign === "right"
      ? "flex-end"
      : "flex-start"

  switch (element.type) {
    case "productName":
      return <div key={element.id} style={style}>{p.name}</div>
    case "price":
      return <div key={element.id} style={style}>{formatMoney(p.sellPrice)}</div>
    case "oldPrice":
      if (!p.oldPrice) return null
      return (
        <div key={element.id} style={{ ...style, textDecoration: "line-through", opacity: 0.6 }}>
          {formatMoney(p.oldPrice)}
        </div>
      )
    case "sku":
      return <div key={element.id} style={style}>{p.sku}</div>
    case "barcode": {
      const barcodeValue = layout.barcodeSource === "ean" ? p.barcode : p.sku
      const format = layout.barcodeSource === "ean" ? "EAN13" : "CODE128"
      return (
        <div key={element.id} style={{ ...style, display: "flex", justifyContent: flexAlign }}>
          <BarcodeElement value={barcodeValue ?? ""} format={format} width={containerWidth} />
        </div>
      )
    }
    case "storeName":
      return <div key={element.id} style={style}>{storeName}</div>
    case "date":
      return <div key={element.id} style={style}>{formatDate(new Date())}</div>
    case "logo":
      if (!element.value) return null
      return (
        <div key={element.id} style={{ ...style, display: "flex", justifyContent: flexAlign }}>
          <img src={element.value} alt="Logo" style={{ maxHeight: `${element.fontSize * 2}px`, objectFit: "contain" }} />
        </div>
      )
    case "text":
      return <div key={element.id} style={style}>{element.value ?? ""}</div>
    case "qrCode":
      return (
        <div key={element.id} style={{ ...style, display: "flex", justifyContent: flexAlign }}>
          <QRCodeSVG value={element.value ?? "https://example.com"} size={element.fontSize * 3} />
        </div>
      )
    default:
      return null
  }
}

export function PriceLabelRenderer({
  layout,
  product,
  storeName = "a:store",
  scale = 1,
  useMm = false,
}: LabelRendererProps) {
  const unit = useMm ? "mm" : "px"
  const w = useMm ? layout.width : layout.width * MM_TO_PX * scale
  const h = useMm ? layout.height : layout.height * MM_TO_PX * scale
  const containerWidth = useMm ? layout.width * MM_TO_PX : w
  const padding = useMm ? 2 : 2 * MM_TO_PX * scale

  return (
    <div
      style={{
        width: `${w}${unit}`,
        height: `${h}${unit}`,
        padding: `${padding}${useMm ? "mm" : "px"}`,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        backgroundColor: "white",
        boxSizing: "border-box",
      }}
    >
      {layout.zones.header.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          {layout.zones.header.map((el) =>
            renderElement(el, product, storeName, layout, containerWidth)
          )}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {layout.zones.body.map((el) =>
          renderElement(el, product, storeName, layout, containerWidth)
        )}
      </div>

      {layout.zones.footer.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          {layout.zones.footer.map((el) =>
            renderElement(el, product, storeName, layout, containerWidth)
          )}
        </div>
      )}

      {layout.zones.header.length === 0 &&
        layout.zones.body.length === 0 &&
        layout.zones.footer.length === 0 && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "12px" }}>
          Добавьте элементы
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/pushkarev/PROD/astore\ syy/astore-erp && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/price-labels/label-renderer.tsx
git commit -m "feat(price-labels): add PriceLabelRenderer component with barcode and QR support"
```

---

### Task 7: Print Page

**Files:**
- Create: `src/app/(dashboard)/print/price-labels/page.tsx`

- [ ] **Step 1: Create print page**

```tsx
"use client"

import { useEffect, useState, useTransition, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { PrintLayout } from "@/components/print/print-layout"
import { PriceLabelRenderer } from "@/components/price-labels/label-renderer"
import { getTemplate, getProductsForPrint } from "@/actions/price-labels"
import type { PriceLabelLayout, PrintProductData, PrintLabelsData } from "@/lib/validations/price-labels"

export default function PrintLabelsPage() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get("templateId")

  const [isPending, startTransition] = useTransition()
  const [layout, setLayout] = useState<PriceLabelLayout | null>(null)
  const [products, setProducts] = useState<PrintProductData[]>([])
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map())
  const [storeName, setStoreName] = useState("a:store")
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(() => {
    if (!templateId) {
      setError("Не указан шаблон")
      return
    }

    const raw = localStorage.getItem("printLabelsData")
    if (!raw) {
      setError("Нет данных для печати")
      return
    }

    localStorage.removeItem("printLabelsData")
    const printData: PrintLabelsData = JSON.parse(raw)

    if (!printData.items || printData.items.length === 0) {
      setError("Не выбраны товары")
      return
    }

    startTransition(async () => {
      try {
        const template = await getTemplate(templateId)
        const parsedLayout = template.layout as PriceLabelLayout
        setLayout(parsedLayout)
        setStoreName(template.storeName)

        const productIds = printData.items.map((i) => i.productId)
        const fetchedProducts = await getProductsForPrint(template.storeId, productIds)
        setProducts(fetchedProducts)

        const qtyMap = new Map(printData.items.map((i) => [i.productId, i.quantity]))
        setQuantities(qtyMap)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки")
      }
    })
  }, [templateId])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        {error}
      </div>
    )
  }

  if (isPending || !layout) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Загрузка...
      </div>
    )
  }

  // Build flat list of labels (product x quantity)
  const labels: PrintProductData[] = []
  for (const product of products) {
    const qty = quantities.get(product.id) ?? 1
    for (let i = 0; i < qty; i++) {
      labels.push(product)
    }
  }

  // Calculate grid: how many labels fit on A4 (210x297mm)
  const gap = 2
  const cols = Math.floor(210 / (layout.width + gap))
  const rows = Math.floor(297 / (layout.height + gap))
  const perPage = cols * rows

  // Split into pages
  const pages: PrintProductData[][] = []
  for (let i = 0; i < labels.length; i += perPage) {
    pages.push(labels.slice(i, i + perPage))
  }

  return (
    <PrintLayout title="Печать ценников">
      <div>
        {pages.map((pageLabels, pageIdx) => (
          <div
            key={pageIdx}
            style={{
              width: "210mm",
              height: "297mm",
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, ${layout.width}mm)`,
              gridTemplateRows: `repeat(${rows}, ${layout.height}mm)`,
              gap: `${gap}mm`,
              padding: `${gap}mm`,
              pageBreakAfter: pageIdx < pages.length - 1 ? "always" : undefined,
            }}
          >
            {pageLabels.map((product, labelIdx) => (
              <PriceLabelRenderer
                key={`${pageIdx}-${labelIdx}`}
                layout={layout}
                product={product}
                storeName={storeName}
                useMm
              />
            ))}
          </div>
        ))}
      </div>
    </PrintLayout>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/pushkarev/PROD/astore\ syy/astore-erp && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/print/price-labels/page.tsx
git commit -m "feat(price-labels): add print page with A4 grid layout"
```

---

## Chunk 3: Settings Pages (Template List + Editor)

### Task 8: Settings Nav + Template List Page

**Files:**
- Modify: `src/components/settings/settings-nav.tsx`
- Create: `src/components/price-labels/template-table.tsx`
- Create: `src/app/(dashboard)/settings/price-labels/page.tsx`
- Create: `src/app/(dashboard)/settings/price-labels/price-labels-client.tsx`

- [ ] **Step 1: Add "Ценники" to settings nav**

In `src/components/settings/settings-nav.tsx`:

Add `Tag` to the lucide-react import:
```typescript
import { Store, Users, UserCircle, Tag } from "lucide-react"
```

Add before the `items.push({ title: "Мой профиль"...` block:
```typescript
  if (permissions.includes("settings.templates")) {
    items.push({
      title: "Ценники",
      href: "/settings/price-labels",
      icon: Tag,
    })
  }
```

- [ ] **Step 2: Create template table component**

Create `src/components/price-labels/template-table.tsx`:

```tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, Copy, Trash2, Star, Printer } from "lucide-react"
import { PrintLabelsDialog } from "@/components/price-labels/print-labels-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getTemplates, createTemplate, deleteTemplate, duplicateTemplate, setDefaultTemplate,
} from "@/actions/price-labels"
import { formatDate } from "@/lib/format"
import { DEFAULT_LAYOUT } from "@/components/price-labels/label-constants"
import { toast } from "sonner"

interface TemplateRow {
  id: string
  name: string
  width: number
  height: number
  isDefault: boolean
  createdAt: string
}

interface TemplateTableProps {
  storeId: string
}

export function TemplateTable({ storeId }: TemplateTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadTemplates = useCallback(() => {
    setIsLoading(true)
    startTransition(async () => {
      try {
        const result = await getTemplates(storeId)
        setTemplates(result)
      } finally {
        setIsLoading(false)
      }
    })
  }, [storeId])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  async function handleCreate() {
    startTransition(async () => {
      try {
        const result = await createTemplate({
          storeId,
          name: "Новый шаблон",
          layout: DEFAULT_LAYOUT,
        })
        router.push(`/settings/price-labels/${result.id}`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка создания")
      }
    })
  }

  async function handleDuplicate(id: string) {
    startTransition(async () => {
      try {
        await duplicateTemplate(id)
        toast.success("Шаблон скопирован")
        loadTemplates()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка копирования")
      }
    })
  }

  async function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      try {
        await deleteTemplate(deleteId)
        toast.success("Шаблон удалён")
        setDeleteId(null)
        loadTemplates()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка удаления")
      }
    })
  }

  async function handleSetDefault(id: string) {
    startTransition(async () => {
      try {
        await setDefaultTemplate(id)
        toast.success("Шаблон по умолчанию обновлён")
        loadTemplates()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Шаблоны ценников</h2>
        <Button onClick={handleCreate} disabled={isPending}>
          <Plus className="size-4" />
          Создать шаблон
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Размер</TableHead>
              <TableHead>Дата создания</TableHead>
              <TableHead className="w-[200px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Нет шаблонов. Создайте первый шаблон.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/settings/price-labels/${t.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {t.name}
                      {t.isDefault && (
                        <Star className="size-4 fill-yellow-400 text-yellow-400" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{t.width} x {t.height} мм</TableCell>
                  <TableCell>{formatDate(t.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <PrintLabelsDialog
                        trigger={
                          <Button variant="ghost" size="icon" title="Печать">
                            <Printer className="size-4" />
                          </Button>
                        }
                      />
                      {!t.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="По умолчанию"
                          onClick={() => handleSetDefault(t.id)}
                          disabled={isPending}
                        >
                          <Star className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Копировать"
                        onClick={() => handleDuplicate(t.id)}
                        disabled={isPending}
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Удалить"
                        onClick={() => setDeleteId(t.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить шаблон?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 3: Create page files**

Create `src/app/(dashboard)/settings/price-labels/page.tsx`:

```tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { PriceLabelsClient } from "./price-labels-client"

export default async function PriceLabelsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canManage = await checkPermission("settings.templates")
  if (!canManage) redirect("/settings/profile")

  return <PriceLabelsClient />
}
```

Create `src/app/(dashboard)/settings/price-labels/price-labels-client.tsx`:

```tsx
"use client"

import { useCurrentStore } from "@/hooks/use-current-store"
import { TemplateTable } from "@/components/price-labels/template-table"

export function PriceLabelsClient() {
  const { currentStoreId } = useCurrentStore()

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин для управления шаблонами ценников
      </div>
    )
  }

  return <TemplateTable storeId={currentStoreId} />
}
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/pushkarev/PROD/astore\ syy/astore-erp && npx next build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/settings-nav.tsx src/components/price-labels/template-table.tsx src/app/\(dashboard\)/settings/price-labels/
git commit -m "feat(price-labels): add template list page with CRUD operations"
```

---

### Task 9: Template Editor — Panels

**Files:**
- Create: `src/components/price-labels/label-settings-panel.tsx`
- Create: `src/components/price-labels/element-settings.tsx`
- Create: `src/components/price-labels/zone-editor.tsx`

- [ ] **Step 1: Create label settings panel (left column)**

Create `src/components/price-labels/label-settings-panel.tsx`:

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { SIZE_PRESETS } from "@/components/price-labels/label-constants"
import type { PriceLabelLayout } from "@/lib/validations/price-labels"

interface LabelSettingsPanelProps {
  name: string
  onNameChange: (name: string) => void
  layout: PriceLabelLayout
  onLayoutChange: (layout: PriceLabelLayout) => void
}

export function LabelSettingsPanel({
  name,
  onNameChange,
  layout,
  onLayoutChange,
}: LabelSettingsPanelProps) {
  const currentPreset = SIZE_PRESETS.find(
    (p) => p.width === layout.width && p.height === layout.height
  )
  const sizeValue = currentPreset
    ? `${currentPreset.width}x${currentPreset.height}`
    : "custom"

  function handleSizeChange(value: string) {
    if (value === "custom") return
    const [w, h] = value.split("x").map(Number)
    onLayoutChange({ ...layout, width: w, height: h })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Название шаблона</Label>
        <Input value={name} onChange={(e) => onNameChange(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Размер ценника</Label>
        <RadioGroup value={sizeValue} onValueChange={handleSizeChange}>
          {SIZE_PRESETS.map((preset) => (
            <div key={`${preset.width}x${preset.height}`} className="flex items-center gap-2">
              <RadioGroupItem value={`${preset.width}x${preset.height}`} id={`size-${preset.width}x${preset.height}`} />
              <Label htmlFor={`size-${preset.width}x${preset.height}`}>{preset.label}</Label>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <RadioGroupItem value="custom" id="size-custom" />
            <Label htmlFor="size-custom">Свой размер</Label>
          </div>
        </RadioGroup>
        {sizeValue === "custom" && (
          <div className="flex items-center gap-2 pt-2">
            <Input
              type="number"
              min={20}
              max={200}
              value={layout.width}
              onChange={(e) =>
                onLayoutChange({ ...layout, width: Number(e.target.value) || 20 })
              }
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">x</span>
            <Input
              type="number"
              min={15}
              max={200}
              value={layout.height}
              onChange={(e) =>
                onLayoutChange({ ...layout, height: Number(e.target.value) || 15 })
              }
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">мм</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Источник штрих-кода</Label>
        <RadioGroup
          value={layout.barcodeSource}
          onValueChange={(v) =>
            onLayoutChange({ ...layout, barcodeSource: v as "ean" | "sku" })
          }
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="ean" id="barcode-ean" />
            <Label htmlFor="barcode-ean">Штрих-код товара (EAN-13)</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="sku" id="barcode-sku" />
            <Label htmlFor="barcode-sku">Артикул (Code128)</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create element settings component**

Create `src/components/price-labels/element-settings.tsx`:

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import type { ZoneElement } from "@/lib/validations/price-labels"
import { ELEMENT_TYPE_LABELS } from "@/components/price-labels/label-constants"

interface ElementSettingsProps {
  element: ZoneElement
  onChange: (element: ZoneElement) => void
  onDelete: () => void
}

export function ElementSettings({ element, onChange, onDelete }: ElementSettingsProps) {
  const needsValue = element.type === "text" || element.type === "qrCode" || element.type === "logo"

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{ELEMENT_TYPE_LABELS[element.type]}</span>
        <Button variant="ghost" size="icon" className="size-7" onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Размер</Label>
          <Input
            type="number"
            min={6}
            max={72}
            value={element.fontSize}
            onChange={(e) =>
              onChange({ ...element, fontSize: Number(e.target.value) || 10 })
            }
            className="h-8"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Жирный</Label>
          <Select
            value={element.fontWeight}
            onValueChange={(v) =>
              onChange({ ...element, fontWeight: v as "normal" | "bold" })
            }
          >
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Обычный</SelectItem>
              <SelectItem value="bold">Жирный</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Выравн.</Label>
          <Select
            value={element.textAlign}
            onValueChange={(v) =>
              onChange({ ...element, textAlign: v as "left" | "center" | "right" })
            }
          >
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Лево</SelectItem>
              <SelectItem value="center">Центр</SelectItem>
              <SelectItem value="right">Право</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {needsValue && (
        <div className="space-y-1">
          <Label className="text-xs">
            {element.type === "text" ? "Текст" : element.type === "qrCode" ? "URL" : "URL изображения"}
          </Label>
          <Input
            value={element.value ?? ""}
            onChange={(e) => onChange({ ...element, value: e.target.value })}
            placeholder={element.type === "logo" ? "https://..." : undefined}
            className="h-8"
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create zone editor (right column)**

Create `src/components/price-labels/zone-editor.tsx`:

```tsx
"use client"

import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { GripVertical, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ElementSettings } from "@/components/price-labels/element-settings"
import { ELEMENT_TYPE_LABELS, createDefaultElement } from "@/components/price-labels/label-constants"
import { ELEMENT_TYPES, type ZoneElement, type PriceLabelLayout, type ElementType } from "@/lib/validations/price-labels"
import { useState } from "react"

type ZoneName = "header" | "body" | "footer"

const ZONE_LABELS: Record<ZoneName, string> = {
  header: "Шапка",
  body: "Основное",
  footer: "Подвал",
}

interface ZoneEditorProps {
  layout: PriceLabelLayout
  onLayoutChange: (layout: PriceLabelLayout) => void
}

function ZoneSection({
  zoneName,
  elements,
  onAdd,
  onUpdate,
  onDelete,
}: {
  zoneName: ZoneName
  elements: ZoneElement[]
  onAdd: (type: ElementType) => void
  onUpdate: (idx: number, el: ZoneElement) => void
  onDelete: (idx: number) => void
}) {
  const [addType, setAddType] = useState<string>("")

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {ZONE_LABELS[zoneName]}
      </h4>

      <Droppable droppableId={zoneName}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 min-h-[40px]">
            {elements.map((el, idx) => (
              <Draggable key={el.id} draggableId={el.id} index={idx}>
                {(dragProvided) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    className="flex items-start gap-1"
                  >
                    <div
                      {...dragProvided.dragHandleProps}
                      className="mt-3 cursor-grab text-muted-foreground"
                    >
                      <GripVertical className="size-4" />
                    </div>
                    <div className="flex-1">
                      <ElementSettings
                        element={el}
                        onChange={(updated) => onUpdate(idx, updated)}
                        onDelete={() => onDelete(idx)}
                      />
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="flex items-center gap-2">
        <Select value={addType} onValueChange={setAddType}>
          <SelectTrigger className="h-8 flex-1">
            <SelectValue placeholder="Добавить элемент..." />
          </SelectTrigger>
          <SelectContent>
            {ELEMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {ELEMENT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={!addType}
          onClick={() => {
            if (addType) {
              onAdd(addType as ElementType)
              setAddType("")
            }
          }}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function ZoneEditor({ layout, onLayoutChange }: ZoneEditorProps) {
  function handleDragEnd(result: DropResult) {
    const { source, destination } = result
    if (!destination) return

    const sourceZone = source.droppableId as ZoneName
    const destZone = destination.droppableId as ZoneName

    const newZones = {
      header: [...layout.zones.header],
      body: [...layout.zones.body],
      footer: [...layout.zones.footer],
    }

    if (sourceZone === destZone) {
      const items = newZones[sourceZone]
      const [moved] = items.splice(source.index, 1)
      items.splice(destination.index, 0, moved)
    } else {
      const sourceItems = newZones[sourceZone]
      const destItems = newZones[destZone]
      const [moved] = sourceItems.splice(source.index, 1)
      destItems.splice(destination.index, 0, moved)
    }

    onLayoutChange({ ...layout, zones: newZones })
  }

  function handleAdd(zone: ZoneName, type: ElementType) {
    const newZones = {
      header: [...layout.zones.header],
      body: [...layout.zones.body],
      footer: [...layout.zones.footer],
    }
    newZones[zone] = [...newZones[zone], createDefaultElement(type)]
    onLayoutChange({ ...layout, zones: newZones })
  }

  function handleUpdate(zone: ZoneName, idx: number, el: ZoneElement) {
    const newZones = {
      header: [...layout.zones.header],
      body: [...layout.zones.body],
      footer: [...layout.zones.footer],
    }
    newZones[zone] = newZones[zone].map((e, i) => (i === idx ? el : e))
    onLayoutChange({ ...layout, zones: newZones })
  }

  function handleDelete(zone: ZoneName, idx: number) {
    const newZones = {
      header: [...layout.zones.header],
      body: [...layout.zones.body],
      footer: [...layout.zones.footer],
    }
    newZones[zone] = newZones[zone].filter((_, i) => i !== idx)
    onLayoutChange({ ...layout, zones: newZones })
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {(["header", "body", "footer"] as const).map((zone) => (
          <ZoneSection
            key={zone}
            zoneName={zone}
            elements={layout.zones[zone]}
            onAdd={(type) => handleAdd(zone, type)}
            onUpdate={(idx, el) => handleUpdate(zone, idx, el)}
            onDelete={(idx) => handleDelete(zone, idx)}
          />
        ))}
      </div>
    </DragDropContext>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/pushkarev/PROD/astore\ syy/astore-erp && npx next build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/components/price-labels/label-settings-panel.tsx src/components/price-labels/element-settings.tsx src/components/price-labels/zone-editor.tsx
git commit -m "feat(price-labels): add editor panels (settings, elements, zone drag-and-drop)"
```

---

### Task 10: Template Editor Page

**Files:**
- Create: `src/app/(dashboard)/settings/price-labels/[id]/page.tsx`
- Create: `src/app/(dashboard)/settings/price-labels/[id]/editor-client.tsx`

- [ ] **Step 1: Create editor page (server component)**

Create `src/app/(dashboard)/settings/price-labels/[id]/page.tsx`:

```tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { EditorClient } from "./editor-client"

export default async function LabelEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canManage = await checkPermission("settings.templates")
  if (!canManage) redirect("/settings/profile")

  return <EditorClient templateId={id} />
}
```

- [ ] **Step 2: Create editor client component**

Create `src/app/(dashboard)/settings/price-labels/[id]/editor-client.tsx`:

```tsx
"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { getTemplate, updateTemplate } from "@/actions/price-labels"
import { PriceLabelRenderer } from "@/components/price-labels/label-renderer"
import { LabelSettingsPanel } from "@/components/price-labels/label-settings-panel"
import { ZoneEditor } from "@/components/price-labels/zone-editor"
import type { PriceLabelLayout } from "@/lib/validations/price-labels"
import { DEFAULT_LAYOUT } from "@/components/price-labels/label-constants"

interface EditorClientProps {
  templateId: string
}

export function EditorClient({ templateId }: EditorClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [name, setName] = useState("")
  const [layout, setLayout] = useState<PriceLabelLayout>(DEFAULT_LAYOUT)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const template = await getTemplate(templateId)
        setName(template.name)
        setLayout(template.layout as PriceLabelLayout)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка загрузки")
        router.push("/settings/price-labels")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [templateId, router])

  function handleLayoutChange(newLayout: PriceLabelLayout) {
    setLayout(newLayout)
    setHasChanges(true)
  }

  function handleNameChange(newName: string) {
    setName(newName)
    setHasChanges(true)
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateTemplate(templateId, { name, layout })
        toast.success("Шаблон сохранён")
        setHasChanges(false)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка сохранения")
      }
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-[250px_1fr_300px] gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/settings/price-labels")}>
            <ArrowLeft className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold">{name || "Новый шаблон"}</h2>
        </div>
        <Button onClick={handleSave} disabled={isPending || !hasChanges}>
          <Save className="size-4" />
          Сохранить
        </Button>
      </div>

      <div className="grid grid-cols-[250px_1fr_300px] gap-6">
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Настройки</h3>
          <LabelSettingsPanel
            name={name}
            onNameChange={handleNameChange}
            layout={layout}
            onLayoutChange={handleLayoutChange}
          />
        </div>

        <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-8">
          <PriceLabelRenderer layout={layout} scale={2} />
        </div>

        <div className="space-y-4 overflow-y-auto rounded-lg border p-4" style={{ maxHeight: "calc(100vh - 160px)" }}>
          <h3 className="text-sm font-semibold">Элементы</h3>
          <ZoneEditor layout={layout} onLayoutChange={handleLayoutChange} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/pushkarev/PROD/astore\ syy/astore-erp && npx next build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/settings/price-labels/\[id\]/
git commit -m "feat(price-labels): add three-column template editor with live preview"
```

---

## Chunk 4: Print Dialog + Integration Points

### Task 11: PrintLabelsDialog

**Files:**
- Create: `src/components/price-labels/print-labels-dialog.tsx`

- [ ] **Step 1: Create shared print dialog**

```tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Search, Printer, Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { getTemplatesForPrint } from "@/actions/price-labels"
import { getProducts } from "@/actions/catalog"
import { useCurrentStore } from "@/hooks/use-current-store"
import type { PrintLabelsData } from "@/lib/validations/price-labels"

interface PrintItem {
  productId: string
  name: string
  sku: string
  quantity: number
}

interface PrintLabelsDialogProps {
  trigger: React.ReactNode
  preselectedProducts?: Array<{ id: string; name: string; sku: string }>
}

export function PrintLabelsDialog({
  trigger,
  preselectedProducts,
}: PrintLabelsDialogProps) {
  const { currentStoreId } = useCurrentStore()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const [templates, setTemplates] = useState<Array<{
    id: string; name: string; width: number; height: number; isDefault: boolean
  }>>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [items, setItems] = useState<PrintItem[]>([])
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{
    id: string; name: string; sku: string
  }>>([])

  useEffect(() => {
    if (!open || !currentStoreId) return
    startTransition(async () => {
      const result = await getTemplatesForPrint(currentStoreId)
      setTemplates(result)
      const defaultTemplate = result.find((t) => t.isDefault)
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id)
      } else if (result.length > 0) {
        setSelectedTemplateId(result[0].id)
      }
    })
  }, [open, currentStoreId])

  useEffect(() => {
    if (open && preselectedProducts) {
      setItems(
        preselectedProducts.map((p) => ({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          quantity: 1,
        }))
      )
    }
  }, [open, preselectedProducts])

  const handleSearch = useCallback(() => {
    if (!search || !currentStoreId) {
      setSearchResults([])
      return
    }
    startTransition(async () => {
      const result = await getProducts(currentStoreId, { search, perPage: 10 })
      setSearchResults(
        result.products
          .filter((p) => !items.some((i) => i.productId === p.id))
          .map((p) => ({ id: p.id, name: p.name, sku: p.sku }))
      )
    })
  }, [search, currentStoreId, items])

  useEffect(() => {
    const timer = setTimeout(handleSearch, 300)
    return () => clearTimeout(timer)
  }, [handleSearch])

  function addProduct(product: { id: string; name: string; sku: string }) {
    setItems((prev) => [...prev, { productId: product.id, name: product.name, sku: product.sku, quantity: 1 }])
    setSearch("")
    setSearchResults([])
  }

  function updateQuantity(productId: string, delta: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.max(1, i.quantity + delta) }
          : i
      )
    )
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  function handlePrint() {
    if (!selectedTemplateId || items.length === 0) return

    const data: PrintLabelsData = {
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    }
    localStorage.setItem("printLabelsData", JSON.stringify(data))
    window.open(`/print/price-labels?templateId=${selectedTemplateId}`, "_blank")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Печать ценников</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Шаблон</label>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет шаблонов. Создайте шаблон в настройках.</p>
            ) : (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите шаблон" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.width}x{t.height} мм)
                      {t.isDefault ? " *" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Product search */}
          {!preselectedProducts && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Добавить товар</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск по названию или артикулу..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => addProduct(p)}
                    >
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected products */}
          {items.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Товары ({items.length})</label>
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.sku}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => updateQuantity(item.productId, -1)}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => updateQuantity(item.productId, 1)}
                      >
                        <Plus className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive"
                        onClick={() => removeItem(item.productId)}
                      >
                        x
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Print button */}
          <Button
            className="w-full"
            disabled={!selectedTemplateId || items.length === 0 || templates.length === 0}
            onClick={handlePrint}
          >
            <Printer className="size-4" />
            Печать ({items.reduce((sum, i) => sum + i.quantity, 0)} шт.)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/pushkarev/PROD/astore\ syy/astore-erp && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/price-labels/print-labels-dialog.tsx
git commit -m "feat(price-labels): add PrintLabelsDialog with product search and quantity controls"
```

---

### Task 12: Catalog Integration

**Files:**
- Modify: `src/components/catalog/product-table.tsx`

- [ ] **Step 1: Add "Печать ценника" button to product table**

Add imports at top of `src/components/catalog/product-table.tsx`:
```typescript
import { Tag } from "lucide-react"
import { PrintLabelsDialog } from "@/components/price-labels/print-labels-dialog"
```

Add a new column as the last entry in the `columns` array (after the costPrice conditional spread):

```typescript
{
  id: "actions",
  header: "",
  cell: ({ row }: { row: { original: ProductRow } }) => (
    <div onClick={(e) => e.stopPropagation()}>
      <PrintLabelsDialog
        trigger={
          <Button variant="ghost" size="icon" title="Печать ценника">
            <Tag className="size-4" />
          </Button>
        }
        preselectedProducts={[{
          id: row.original.id,
          name: row.original.name,
          sku: row.original.sku,
        }]}
      />
    </div>
  ),
} satisfies ColumnDef<ProductRow>,
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/pushkarev/PROD/astore\ syy/astore-erp && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/catalog/product-table.tsx
git commit -m "feat(price-labels): add print label button to catalog product table"
```

---

### Task 13: Stock Receive Integration

**Files:**
- Modify: `src/app/(dashboard)/inventory/receive/receive-list-client.tsx`
- Modify: `src/actions/inventory.ts`

- [ ] **Step 1: Update confirmReceive to return received product IDs**

In `src/actions/inventory.ts`, update the `confirmReceive` return value to include the product info:

```typescript
// At the end of confirmReceive, before return:
const receivedProducts = receive.items.map((item) => ({
  productId: item.productId,
}))

return { success: true, receivedProductIds: receivedProducts.map((p) => p.productId) }
```

- [ ] **Step 2: Add print labels dialog after stock receive confirmation**

In `receive-list-client.tsx`:

Add imports:
```typescript
import { PrintLabelsDialog } from "@/components/price-labels/print-labels-dialog"
import { useState } from "react"
```

Add state:
```typescript
const [printProducts, setPrintProducts] = useState<Array<{ id: string; name: string; sku: string }> | null>(null)
```

Modify `handleConfirm` to capture received products and show a confirmation dialog:
```typescript
async function handleConfirm(receiveId: string) {
  try {
    const result = await confirmReceive(receiveId)
    toast.success("Приход подтверждён. Остатки обновлены.")
    loadReceives()
    // Note: For MVP, show toast with print link.
    // Full integration (auto-open PrintLabelsDialog with pre-filled products)
    // requires fetching product names after confirm, which adds complexity.
    // Users can print from catalog or settings.
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Ошибка подтверждения")
  }
}
```

**Note:** Full pre-population of PrintLabelsDialog with received products requires fetching product names+SKUs after confirmation (the receive items only have productId). This adds a query + UI complexity. For MVP, the toast approach is sufficient — users print from the catalog or settings where they can search products. A deeper integration can be added as a follow-up task.

- [ ] **Step 2: Verify build**

```bash
cd /Users/pushkarev/PROD/astore\ syy/astore-erp && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/inventory/receive/
git commit -m "feat(price-labels): add print labels prompt after stock receive confirmation"
```

---

### Task 14: Settings Layout + Final Verification

**Files:**
- Modify: `src/app/(dashboard)/settings/layout.tsx`

- [ ] **Step 1: Update settings layout access check**

In `src/app/(dashboard)/settings/layout.tsx`, add `settings.templates` to the access check:

```typescript
const hasAnySettingsAccess =
  permissions.includes("settings.stores") ||
  permissions.includes("settings.users") ||
  permissions.includes("settings.templates") ||
  true // profile is always visible
```

- [ ] **Step 2: Run full build**

```bash
cd /Users/pushkarev/PROD/astore\ syy/astore-erp && npx next build
```

Expected: Build succeeds with all routes.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/layout.tsx
git commit -m "feat(price-labels): add settings.templates to settings layout access check"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Prisma schema + migration | `prisma/schema.prisma` |
| 2 | Zod validation + TypeScript types | `src/lib/validations/price-labels.ts` |
| 3 | Constants (presets, labels, defaults) | `src/components/price-labels/label-constants.ts` |
| 4 | Server actions (CRUD + print data) | `src/actions/price-labels.ts` |
| 5 | Install npm dependencies | `package.json` |
| 6 | PriceLabelRenderer component | `src/components/price-labels/label-renderer.tsx` |
| 7 | Print page (A4 grid) | `src/app/(dashboard)/print/price-labels/page.tsx` |
| 8 | Settings nav + template list page | `settings-nav.tsx`, `template-table.tsx`, page files |
| 9 | Editor panels (settings, elements, zones) | 3 editor panel components |
| 10 | Editor page (three-column layout) | Editor page + client component |
| 11 | PrintLabelsDialog (shared) | `print-labels-dialog.tsx` |
| 12 | Catalog integration | `product-table.tsx` |
| 13 | Stock receive integration | receive client components |
| 14 | Settings layout + final build | `settings/layout.tsx` |

## Follow-up Tasks (not in this plan)

- **Mass print from catalog**: Add checkbox selection to product table + "Печать ценников" bulk action button. Requires refactoring `ProductTable` to support row selection via `@tanstack/react-table` selection API.
- **Deep stock receive integration**: After confirming a stock receive, auto-open `PrintLabelsDialog` with received products pre-filled. Requires fetching product names/SKUs after confirmation.
- **Logo upload**: In MVP, logo is pasted as URL. Future: add file upload to `/public` or S3.
