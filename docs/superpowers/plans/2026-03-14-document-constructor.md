# Document Constructor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 6 hardcoded print components with a block-based document template constructor driven by JSON layouts stored in PostgreSQL.

**Architecture:** Prisma model `DocumentTemplate` stores JSON block layouts per document type. A unified `DocumentRenderer` component renders blocks for both editor preview and print pages. Server actions handle CRUD + document data resolution from existing entities (Sale, CustomOrder, StockReceive, StockWriteOff, Repair).

**Tech Stack:** Next.js App Router, Prisma 7, Zod, TailwindCSS, shadcn/ui v4, @hello-pangea/dnd, existing `formatMoney`/`formatDate` from `src/lib/format.ts`.

**Spec:** `docs/superpowers/specs/2026-03-14-document-constructor-design.md`

---

## Chunk 1: Data Model + Validations + Variables

### Task 1: Prisma Schema — DocumentType enum + DocumentTemplate model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add DocumentType enum and DocumentTemplate model to schema**

Add after the `PriceLabelTemplate` model:

```prisma
enum DocumentType {
  SALE_RECEIPT
  ORDER_FORM
  RECEIVE_DOC
  WRITE_OFF_DOC
  REPAIR_RECEIPT
  REPAIR_DELIVERY
}

model DocumentTemplate {
  id          String       @id @default(cuid())
  storeId     String
  store       Store        @relation(fields: [storeId], references: [id])
  name        String
  type        DocumentType
  layout      Json
  isDefault   Boolean      @default(false)
  createdById String
  createdBy   User         @relation("DocumentTemplateCreatedBy", fields: [createdById], references: [id])
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}
```

Add relations to existing models:
- In `Store` model, add: `documentTemplates DocumentTemplate[]`
- In `User` model, add: `documentTemplates DocumentTemplate[] @relation("DocumentTemplateCreatedBy")`

- [ ] **Step 2: Run migration**

```bash
cd astore-erp && npx prisma migrate dev --name add-document-templates
```

Expected: Migration created successfully.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Verify by building**

```bash
npx next build 2>&1 | tail -20
```

Expected: Build succeeds (or at least no Prisma-related errors).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add DocumentType enum and DocumentTemplate model"
```

---

### Task 2: Zod Schemas + TypeScript Interfaces

**Files:**
- Create: `src/lib/validations/document-templates.ts`

- [ ] **Step 1: Create the validation file with all block types and schemas**

Reference the spec section 1.2 for exact interfaces. Follow the pattern from `src/lib/validations/price-labels.ts`.

```typescript
import { z } from "zod"

// ---- Document types ----

export const DOCUMENT_TYPES = [
  "SALE_RECEIPT",
  "ORDER_FORM",
  "RECEIVE_DOC",
  "WRITE_OFF_DOC",
  "REPAIR_RECEIPT",
  "REPAIR_DELIVERY",
] as const

export type DocumentType = typeof DOCUMENT_TYPES[number]

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SALE_RECEIPT: "Товарный чек",
  ORDER_FORM: "Бланк заказа",
  RECEIVE_DOC: "Приходная накладная",
  WRITE_OFF_DOC: "Акт списания",
  REPAIR_RECEIPT: "Акт приёмки",
  REPAIR_DELIVERY: "Акт выдачи",
}

// ---- Block type constants ----

export const BLOCK_TYPES = [
  "text", "heading", "keyValue", "table",
  "signatures", "divider", "image", "spacer", "panel",
] as const

export type BlockType = typeof BLOCK_TYPES[number]

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  text: "Текст",
  heading: "Заголовок",
  keyValue: "Ключ-значение",
  table: "Таблица",
  signatures: "Подписи",
  divider: "Разделитель",
  image: "Изображение",
  spacer: "Отступ",
  panel: "Панель",
}

// ---- Zod schemas ----

const showIfConditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(["exists", "gt", "eq"]),
  value: z.union([z.number(), z.string()]).optional(),
})

const baseBlockSchema = z.object({
  id: z.string().min(1),
  showIf: showIfConditionSchema.nullable().optional(),
})

const textBlockSchema = baseBlockSchema.extend({
  type: z.literal("text"),
  content: z.string(),
  fontSize: z.number().min(6).max(72).default(12),
  fontWeight: z.enum(["normal", "bold"]).default("normal"),
  textAlign: z.enum(["left", "center", "right"]).default("left"),
})

const headingBlockSchema = baseBlockSchema.extend({
  type: z.literal("heading"),
  content: z.string(),
  fontSize: z.number().min(6).max(72).default(16),
  fontWeight: z.enum(["normal", "bold"]).default("bold"),
  textAlign: z.enum(["left", "center", "right"]).default("center"),
})

const keyValueItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  showIf: showIfConditionSchema.nullable().optional(),
})

const keyValueBlockSchema = baseBlockSchema.extend({
  type: z.literal("keyValue"),
  items: z.array(keyValueItemSchema).min(1),
  fontSize: z.number().min(6).max(72).default(12),
  layout: z.enum(["stacked", "inline"]).default("stacked"),
})

const tableColumnSchema = z.object({
  key: z.string().min(1),
  header: z.string(),
  width: z.string().default("auto"),
  align: z.enum(["left", "center", "right"]).default("left"),
})

const tableBlockSchema = baseBlockSchema.extend({
  type: z.literal("table"),
  columns: z.array(tableColumnSchema).min(1),
  showRowNumbers: z.boolean().default(true),
  showTotal: z.boolean().default(true),
  totalLabel: z.string().default("Итого"),
  fontSize: z.number().min(6).max(72).default(11),
})

const signatureItemSchema = z.object({
  label: z.string(),
  name: z.string().default(""),
})

const signaturesBlockSchema = baseBlockSchema.extend({
  type: z.literal("signatures"),
  items: z.array(signatureItemSchema).min(1),
  showDate: z.boolean().default(false),
})

const dividerBlockSchema = baseBlockSchema.extend({
  type: z.literal("divider"),
  style: z.enum(["solid", "dashed"]).default("solid"),
  margin: z.number().min(0).max(100).default(8),
})

const imageBlockSchema = baseBlockSchema.extend({
  type: z.literal("image"),
  src: z.string(),
  maxHeight: z.number().min(10).max(500).default(100),
  align: z.enum(["left", "center", "right"]).default("center"),
})

const spacerBlockSchema = baseBlockSchema.extend({
  type: z.literal("spacer"),
  height: z.number().min(1).max(200).default(20),
})

// Panel uses a lazy schema for recursive children (excluding nested panels)
const nonPanelBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  headingBlockSchema,
  keyValueBlockSchema,
  tableBlockSchema,
  signaturesBlockSchema,
  dividerBlockSchema,
  imageBlockSchema,
  spacerBlockSchema,
])

const panelBlockSchema = baseBlockSchema.extend({
  type: z.literal("panel"),
  border: z.boolean().default(true),
  padding: z.number().min(0).max(100).default(12),
  children: z.array(nonPanelBlockSchema),
})

export const documentBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  headingBlockSchema,
  keyValueBlockSchema,
  tableBlockSchema,
  signaturesBlockSchema,
  dividerBlockSchema,
  imageBlockSchema,
  spacerBlockSchema,
  panelBlockSchema,
])

export const documentLayoutSchema = z.object({
  blocks: z.array(documentBlockSchema),
  pageMargin: z.number().min(0).max(50).default(10),
  fontFamily: z.enum(["serif", "sans-serif"]).default("serif"),
})

export const createDocumentTemplateSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1, "Название обязательно"),
  type: z.enum(DOCUMENT_TYPES),
  layout: documentLayoutSchema,
})

export const updateDocumentTemplateSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  layout: documentLayoutSchema,
})

// ---- TypeScript interfaces ----

export interface ShowIfCondition {
  field: string
  op: "exists" | "gt" | "eq"
  value?: number | string
}

export interface BaseBlock {
  id: string
  type: string
  showIf?: ShowIfCondition | null
}

export interface TextBlock extends BaseBlock {
  type: "text"
  content: string
  fontSize: number
  fontWeight: "normal" | "bold"
  textAlign: "left" | "center" | "right"
}

export interface HeadingBlock extends BaseBlock {
  type: "heading"
  content: string
  fontSize: number
  fontWeight: "normal" | "bold"
  textAlign: "left" | "center" | "right"
}

export interface KeyValueItem {
  label: string
  value: string
  showIf?: ShowIfCondition | null
}

export interface KeyValueBlock extends BaseBlock {
  type: "keyValue"
  items: KeyValueItem[]
  fontSize: number
  layout: "stacked" | "inline"
}

export interface TableColumn {
  key: string
  header: string
  width: string
  align: "left" | "center" | "right"
}

export interface TableBlock extends BaseBlock {
  type: "table"
  columns: TableColumn[]
  showRowNumbers: boolean
  showTotal: boolean
  totalLabel: string
  fontSize: number
}

export interface SignatureItem {
  label: string
  name: string
}

export interface SignaturesBlock extends BaseBlock {
  type: "signatures"
  items: SignatureItem[]
  showDate: boolean
}

export interface DividerBlock extends BaseBlock {
  type: "divider"
  style: "solid" | "dashed"
  margin: number
}

export interface ImageBlock extends BaseBlock {
  type: "image"
  src: string
  maxHeight: number
  align: "left" | "center" | "right"
}

export interface SpacerBlock extends BaseBlock {
  type: "spacer"
  height: number
}

export interface PanelBlock extends BaseBlock {
  type: "panel"
  border: boolean
  padding: number
  children: DocumentBlock[]
}

export type DocumentBlock =
  | TextBlock
  | HeadingBlock
  | KeyValueBlock
  | TableBlock
  | SignaturesBlock
  | DividerBlock
  | ImageBlock
  | SpacerBlock
  | PanelBlock

export interface DocumentLayout {
  blocks: DocumentBlock[]
  pageMargin: number
  fontFamily: "serif" | "sans-serif"
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/validations/document-templates.ts
git commit -m "feat: add Zod schemas and TypeScript interfaces for document templates"
```

---

### Task 3: Document Variables + Demo Data

**Files:**
- Create: `src/lib/document-variables.ts`

- [ ] **Step 1: Create the variables file**

This file defines per-document-type: available variables, which are money/date fields (for auto-formatting), table column definitions, and demo data for the editor preview.

```typescript
import type { DocumentType } from "@/lib/validations/document-templates"

export interface VariableDefinition {
  key: string
  label: string        // Russian label for the UI hint
  isMoney?: boolean
  isDate?: boolean
}

export interface TableColumnDefinition {
  key: string
  label: string        // Russian label
  defaultWidth: string
  defaultAlign: "left" | "center" | "right"
  isMoney?: boolean
}

export interface DocumentTypeConfig {
  variables: VariableDefinition[]
  tableColumns: TableColumnDefinition[]
  hasTable: boolean
  titleTemplate: string    // e.g. "ТОВАРНЫЙ ЧЕК №{{number}}"
}

const SALE_RECEIPT_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Магазин" },
    { key: "storeAddress", label: "Адрес магазина" },
    { key: "storePhone", label: "Телефон магазина" },
    { key: "number", label: "Номер чека" },
    { key: "date", label: "Дата", isDate: true },
    { key: "sellerName", label: "Продавец" },
    { key: "totalAmount", label: "Сумма", isMoney: true },
    { key: "discountAmount", label: "Скидка", isMoney: true },
    { key: "finalAmount", label: "К оплате", isMoney: true },
    { key: "paymentMethods", label: "Способы оплаты" },
  ],
  tableColumns: [
    { key: "productName", label: "Наименование", defaultWidth: "auto", defaultAlign: "left" },
    { key: "productSku", label: "Артикул", defaultWidth: "80px", defaultAlign: "left" },
    { key: "quantity", label: "Кол-во", defaultWidth: "50px", defaultAlign: "center" },
    { key: "price", label: "Цена", defaultWidth: "90px", defaultAlign: "right", isMoney: true },
    { key: "discount", label: "Скидка", defaultWidth: "80px", defaultAlign: "right", isMoney: true },
    { key: "total", label: "Сумма", defaultWidth: "90px", defaultAlign: "right", isMoney: true },
  ],
  hasTable: true,
  titleTemplate: "ТОВАРНЫЙ ЧЕК №{{number}}",
}

const ORDER_FORM_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Магазин" },
    { key: "number", label: "Номер заказа" },
    { key: "date", label: "Дата", isDate: true },
    { key: "sellerName", label: "Продавец" },
    { key: "clientName", label: "Клиент (ФИО)" },
    { key: "clientPhone", label: "Телефон клиента" },
    { key: "clientEmail", label: "E-mail клиента" },
    { key: "totalAmount", label: "Сумма", isMoney: true },
    { key: "prepaidAmount", label: "Предоплата", isMoney: true },
    { key: "remainingAmount", label: "Остаток", isMoney: true },
    { key: "estimatedDays", label: "Срок доставки (дн.)" },
  ],
  tableColumns: [
    { key: "name", label: "Наименование", defaultWidth: "auto", defaultAlign: "left" },
    { key: "quantity", label: "Кол-во", defaultWidth: "50px", defaultAlign: "center" },
    { key: "price", label: "Цена", defaultWidth: "90px", defaultAlign: "right", isMoney: true },
    { key: "total", label: "Сумма", defaultWidth: "90px", defaultAlign: "right", isMoney: true },
  ],
  hasTable: true,
  titleTemplate: "БЛАНК ЗАКАЗА №{{number}}",
}

const RECEIVE_DOC_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Магазин" },
    { key: "supplierName", label: "Поставщик" },
    { key: "number", label: "Номер накладной" },
    { key: "date", label: "Дата", isDate: true },
    { key: "receivedByName", label: "Принял" },
    { key: "totalAmount", label: "Сумма", isMoney: true },
  ],
  tableColumns: [
    { key: "productName", label: "Наименование", defaultWidth: "auto", defaultAlign: "left" },
    { key: "quantity", label: "Кол-во", defaultWidth: "50px", defaultAlign: "center" },
    { key: "costPrice", label: "Себестоимость", defaultWidth: "100px", defaultAlign: "right", isMoney: true },
    { key: "total", label: "Сумма", defaultWidth: "100px", defaultAlign: "right", isMoney: true },
  ],
  hasTable: true,
  titleTemplate: "ПРИХОДНАЯ НАКЛАДНАЯ №{{number}}",
}

const WRITE_OFF_DOC_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Магазин" },
    { key: "number", label: "Номер акта" },
    { key: "date", label: "Дата", isDate: true },
    { key: "reason", label: "Причина" },
    { key: "createdByName", label: "Составил" },
    { key: "totalAmount", label: "Сумма", isMoney: true },
  ],
  tableColumns: [
    { key: "productName", label: "Наименование", defaultWidth: "auto", defaultAlign: "left" },
    { key: "quantity", label: "Кол-во", defaultWidth: "50px", defaultAlign: "center" },
    { key: "costPrice", label: "Себестоимость", defaultWidth: "100px", defaultAlign: "right", isMoney: true },
    { key: "total", label: "Сумма", defaultWidth: "100px", defaultAlign: "right", isMoney: true },
  ],
  hasTable: true,
  titleTemplate: "АКТ СПИСАНИЯ №{{number}}",
}

const REPAIR_RECEIPT_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Магазин" },
    { key: "number", label: "Номер акта" },
    { key: "date", label: "Дата", isDate: true },
    { key: "createdByName", label: "Приёмщик" },
    { key: "clientName", label: "Клиент (ФИО)" },
    { key: "clientPhone", label: "Телефон клиента" },
    { key: "deviceInfo", label: "Устройство" },
    { key: "deviceSerial", label: "Серийный номер / IMEI" },
    { key: "deviceCondition", label: "Состояние" },
    { key: "defectDescription", label: "Описание неисправности" },
    { key: "estimatedCost", label: "Оценка стоимости", isMoney: true },
  ],
  tableColumns: [],
  hasTable: false,
  titleTemplate: "АКТ ПРИЁМКИ №{{number}}",
}

const REPAIR_DELIVERY_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Магазин" },
    { key: "number", label: "Номер акта" },
    { key: "date", label: "Дата приёмки", isDate: true },
    { key: "completedDate", label: "Дата выполнения", isDate: true },
    { key: "clientName", label: "Клиент (ФИО)" },
    { key: "clientPhone", label: "Телефон клиента" },
    { key: "deviceInfo", label: "Устройство" },
    { key: "deviceSerial", label: "Серийный номер / IMEI" },
    { key: "workDone", label: "Выполненная работа" },
    { key: "finalCost", label: "Итого", isMoney: true },
    { key: "totalPaid", label: "Оплачено", isMoney: true },
    { key: "remainingAmount", label: "К доплате", isMoney: true },
    { key: "warrantyDays", label: "Гарантия (дн.)" },
    { key: "warrantyUntil", label: "Гарантия до", isDate: true },
  ],
  tableColumns: [],
  hasTable: false,
  titleTemplate: "АКТ ВЫДАЧИ №{{number}}",
}

export const DOCUMENT_TYPE_CONFIGS: Record<DocumentType, DocumentTypeConfig> = {
  SALE_RECEIPT: SALE_RECEIPT_CONFIG,
  ORDER_FORM: ORDER_FORM_CONFIG,
  RECEIVE_DOC: RECEIVE_DOC_CONFIG,
  WRITE_OFF_DOC: WRITE_OFF_DOC_CONFIG,
  REPAIR_RECEIPT: REPAIR_RECEIPT_CONFIG,
  REPAIR_DELIVERY: REPAIR_DELIVERY_CONFIG,
}

// ---- Demo data for editor preview ----

export const DEMO_DATA: Record<DocumentType, { data: Record<string, unknown>; items: Record<string, unknown>[] }> = {
  SALE_RECEIPT: {
    data: {
      storeName: "a:store Центральный",
      storeAddress: "ул. Ленина, 15",
      storePhone: "+7 (999) 111-11-11",
      number: "000042",
      date: new Date().toISOString(),
      sellerName: "Иван Продавцов",
      totalAmount: 84970,
      discountAmount: 2000,
      finalAmount: 82970,
      paymentMethods: "Наличные: 30 000 ₽, Карта: 52 970 ₽",
    },
    items: [
      { productName: "iPhone 15 128GB", productSku: "APL-IP15-128", quantity: 1, price: 79990, discount: 2000, total: 77990 },
      { productName: "Чехол iPhone 15 Clear", productSku: "CASE-IP15-CLR", quantity: 2, price: 2490, discount: 0, total: 4980 },
    ],
  },
  ORDER_FORM: {
    data: {
      storeName: "a:store Центральный",
      number: "З-000015",
      date: new Date().toISOString(),
      sellerName: "Иван Продавцов",
      clientName: "Алексей Петров",
      clientPhone: "+7 (912) 345-67-89",
      clientEmail: "petrov@mail.ru",
      totalAmount: 119990,
      prepaidAmount: 50000,
      remainingAmount: 69990,
      estimatedDays: 14,
    },
    items: [
      { name: "iPhone 15 Pro 256GB", quantity: 1, price: 119990, total: 119990 },
    ],
  },
  RECEIVE_DOC: {
    data: {
      storeName: "a:store Центральный",
      supplierName: "ООО Техноимпорт",
      number: "ПН-000008",
      date: new Date().toISOString(),
      receivedByName: "Иван Продавцов",
      totalAmount: 150000,
    },
    items: [
      { productName: "iPhone 15 128GB", quantity: 2, costPrice: 65000, total: 130000 },
      { productName: "Чехол iPhone 15 Clear", quantity: 25, costPrice: 800, total: 20000 },
    ],
  },
  WRITE_OFF_DOC: {
    data: {
      storeName: "a:store Центральный",
      number: "СП-000003",
      date: new Date().toISOString(),
      reason: "Брак",
      createdByName: "Иван Продавцов",
      totalAmount: 1400,
    },
    items: [
      { productName: "Защитное стекло iPhone 15", quantity: 5, costPrice: 200, total: 1000 },
      { productName: "Кабель USB-C Lightning 1m", quantity: 1, costPrice: 400, total: 400 },
    ],
  },
  REPAIR_RECEIPT: {
    data: {
      storeName: "a:store Центральный",
      number: "Р-000021",
      date: new Date().toISOString(),
      createdByName: "Мария Старшенко",
      clientName: "Сергей Иванов",
      clientPhone: "+7 (903) 555-12-34",
      deviceInfo: "Смартфон Apple iPhone 14",
      deviceSerial: "DNXXXXXXXX",
      deviceCondition: "Потёртости на корпусе, трещина на экране",
      defectDescription: "Не работает тачскрин в нижней части экрана",
      estimatedCost: 8500,
    },
    items: [],
  },
  REPAIR_DELIVERY: {
    data: {
      storeName: "a:store Центральный",
      number: "Р-000021",
      date: new Date().toISOString(),
      completedDate: new Date().toISOString(),
      clientName: "Сергей Иванов",
      clientPhone: "+7 (903) 555-12-34",
      deviceInfo: "Смартфон Apple iPhone 14",
      deviceSerial: "DNXXXXXXXX",
      workDone: "Замена дисплейного модуля",
      finalCost: 8500,
      totalPaid: 5000,
      remainingAmount: 3500,
      warrantyDays: 30,
      warrantyUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    items: [],
  },
}

// ---- Payment method labels (reused from sale-receipt.tsx) ----

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Банковская карта",
  SBP: "СБП",
  TRANSFER: "Перевод",
  CREDIT: "Рассрочка",
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/document-variables.ts
git commit -m "feat: add document variable definitions and demo data per document type"
```

---

## Chunk 2: Document Renderer

### Task 4: Block Renderers

**Files:**
- Create: `src/components/documents/block-renderers.tsx`

- [ ] **Step 1: Create block renderer functions**

This file exports individual render functions for each block type. Each function takes the block config, document data, items array, and a `resolveText` helper.

Key implementation details:
- `resolveText(content, data)` — replaces `{{variableName}}` with values from `data`, auto-formatting money/date fields using the variable config
- `evaluateShowIf(condition, data)` — evaluates `ShowIfCondition` against data, returns boolean
- `renderTextBlock` — uses `resolveText` on `content`, applies `fontSize`, `fontWeight`, `textAlign`
- `renderHeadingBlock` — same as text but heading-level styles
- `renderKeyValueBlock` — renders `items` as label: value pairs. Each item supports `showIf`. Layout `"stacked"` = one per line (`div`), `"inline"` = flexbox row
- `renderTableBlock` — HTML `<table>` with `className="print-table"`. Shows `thead` with configured columns. Iterates `items` array for `tbody`. Optional row numbers column (№). Optional totals row. Computes `total` from `price * quantity` or `costPrice * quantity`. Empty items → single row "Нет позиций". CSS: `break-inside: avoid` on `<tr>`, `thead { display: table-header-group }` for print pagination
- `renderSignaturesBlock` — renders signature lines using `className="print-signatures"`. Each item: label + underscore line + optional `resolveText(name)`. Optional date line
- `renderDividerBlock` — `<hr>` with `borderStyle` and margin
- `renderImageBlock` — `<img>` with `maxHeight` and `textAlign` wrapper
- `renderSpacerBlock` — empty `<div>` with `height`
- `renderPanelBlock` — `<div>` with optional border, padding, recursively renders `children` blocks (uses the same `renderBlock` dispatcher). Children cannot be PanelBlocks (enforced by Zod schema)

Export a main `renderBlock(block, data, items, documentType)` function that dispatches to the correct renderer.

Look at existing print components for CSS class usage:
- `src/components/print/sale-receipt.tsx` — uses `print-content`, `print-header`, `print-store-name`, `print-title`, `print-info`, `print-table`, `print-totals`, `print-total-row`, `print-total-final`, `print-section`, `print-signatures`, `print-signature-line`, `print-footer-text`

Use these same CSS classes in the block renderers to maintain visual consistency.

The `resolveText` function:
1. Find all `{{variableName}}` patterns via regex `/\{\{(\w+)\}\}/g`
2. Look up value in `data` object
3. If the variable is a money field (check `DOCUMENT_TYPE_CONFIGS[documentType].variables`), format with `formatMoney()` from `src/lib/format.ts`
4. If it's a date field, format with `formatDate()`
5. If not found, leave as `{{variableName}}` literal (visible in preview)

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/documents/block-renderers.tsx
git commit -m "feat: add block renderer functions for all document block types"
```

---

### Task 5: DocumentRenderer Component

**Files:**
- Create: `src/components/documents/document-renderer.tsx`

- [ ] **Step 1: Create the unified renderer component**

```typescript
"use client"

import { renderBlock, evaluateShowIf } from "./block-renderers"
import type { DocumentLayout, DocumentBlock, DocumentType } from "@/lib/validations/document-templates"

interface DocumentRendererProps {
  layout: DocumentLayout
  data: Record<string, unknown>
  items?: Record<string, unknown>[]  // single items array (products/line items). Payments are rendered via the {{paymentMethods}} text variable, not as a secondary table. A multi-source table feature can be added later if needed.
  documentType: DocumentType
  scale?: number
  preview?: boolean
}

export function DocumentRenderer({
  layout,
  data,
  items = [],
  documentType,
  scale = 1,
  preview = false,
}: DocumentRendererProps) {
  const visibleBlocks = layout.blocks.filter(
    (block) => !block.showIf || evaluateShowIf(block.showIf, data)
  )

  return (
    <div
      className="print-document"
      style={{
        fontFamily: layout.fontFamily === "sans-serif"
          ? "Arial, Helvetica, sans-serif"
          : "'PT Serif', 'Times New Roman', serif",
        padding: `${layout.pageMargin}mm`,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top left",
        width: scale !== 1 ? `${100 / scale}%` : undefined,
      }}
    >
      <div className="print-content">
        {visibleBlocks.map((block) => (
          <div key={block.id}>
            {renderBlock(block, data, items, documentType)}
          </div>
        ))}
      </div>
    </div>
  )
}
```

Props match the spec section 3.1. The component is used in both:
- Editor preview: `scale={0.5}` or similar, with demo data from `DEMO_DATA`
- Print pages: `scale={1}`, with real data from `getDocumentData()`

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/documents/document-renderer.tsx
git commit -m "feat: add unified DocumentRenderer component"
```

---

## Chunk 3: Server Actions

### Task 6: Template CRUD Actions

**Files:**
- Create: `src/actions/document-templates.ts`

- [ ] **Step 1: Create server actions file with CRUD operations**

Follow the exact pattern from `src/actions/price-labels.ts`. Key differences:
- Model is `documentTemplate` (not `priceLabelTemplate`)
- Has `type` field (DocumentType enum)
- `setDefaultDocumentTemplate` must scope by BOTH `storeId` AND `type` in the transaction (unlike price labels which only filter by storeId)

Functions to implement:

```typescript
"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requirePermission, checkPermission } from "@/lib/permissions"
import {
  createDocumentTemplateSchema,
  updateDocumentTemplateSchema,
} from "@/lib/validations/document-templates"
import type { DocumentType } from "@/lib/validations/document-templates"
```

1. `getDocumentTemplates(storeId)` — `requirePermission("settings.templates", storeId)`, `findMany` ordered by `type` then `name`, return `id, name, type, isDefault, createdAt` (serialize `createdAt` to ISO string)
2. `getDocumentTemplate(id)` — `findUnique` with `include: { store: { select: { name: true } } }`, permission check, return full template including `layout`
3. `createDocumentTemplate(data)` — validate with `createDocumentTemplateSchema.parse(data)`, permission check, `create` with `layout as object` cast, return `{ id }`
4. `updateDocumentTemplate(id, data)` — find template to get `storeId`, permission check, validate, update `name` + `layout`
5. `deleteDocumentTemplate(id)` — check `isDefault` first: if true, throw `"Нельзя удалить шаблон по умолчанию"`. Permission check, `delete`
6. `duplicateDocumentTemplate(id)` — find, permission check, create copy with `"Копия — "` prefix, `isDefault: false`
7. `setDefaultDocumentTemplate(id)` — find template to get `storeId` AND `type`, permission check, transaction: `updateMany` where `storeId` AND `type` AND `isDefault: true` → set `isDefault: false`, then update target to `isDefault: true`

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/document-templates.ts
git commit -m "feat: add document template CRUD server actions"
```

---

### Task 7: Document Data Resolution Actions

**Files:**
- Modify: `src/actions/document-templates.ts`

- [ ] **Step 1: Add getDefaultTemplate and getDocumentData functions**

Append to the existing file:

`getDefaultTemplate(storeId, type)` — find the default template for a document type:
```typescript
export async function getDefaultTemplate(storeId: string, type: DocumentType) {
  const template = await db.documentTemplate.findFirst({
    where: { storeId, type, isDefault: true },
  })
  if (!template) throw new Error("Шаблон не найден")
  return template
}
```

`getDocumentData(type, entityId)` — loads entity from DB, maps to flat variable object + items array + storeId. Returns `{ storeId, data, items }`. No `storeId` parameter needed — the action extracts it from the entity itself. This is a switch-case by document type. Each case queries the right tables (reusing existing patterns from the current print pages).

**SALE_RECEIPT case:**
Use `getSale(entityId)` from `src/actions/sales.ts` (already imported by print page). Map the returned data to flat variables:
```typescript
import { getSale } from "@/actions/sales"
import { getOrder } from "@/actions/orders"
import { getRepair } from "@/actions/repairs"
import { formatMoney } from "@/lib/format"
import { PAYMENT_METHOD_LABELS } from "@/lib/document-variables"

// Inside getDocumentData (returns { storeId, data, items }):
case "SALE_RECEIPT": {
  const sale = await getSale(entityId)
  // Note: getSale doesn't return storeId directly. Add a lightweight lookup:
  const saleEntity = await db.sale.findUnique({ where: { id: entityId }, select: { storeId: true } })
  if (!saleEntity) throw new Error("Продажа не найдена")
  return {
    storeId: saleEntity.storeId,
    data: {
      storeName: sale.storeName,
      storeAddress: sale.storeAddress ?? "",
      storePhone: sale.storePhone ?? "",
      number: sale.number,
      date: sale.createdAt,
      sellerName: sale.sellerName,
      totalAmount: sale.totalAmount,
      discountAmount: sale.discountAmount,
      finalAmount: sale.finalAmount,
      paymentMethods: sale.payments
        .map(p => `${PAYMENT_METHOD_LABELS[p.method] || p.method}: ${formatMoney(p.amount)}`)
        .join(", "),
    },
    items: sale.items.map(i => ({
      productName: i.productName,
      productSku: i.productSku,
      quantity: i.quantity,
      price: i.price,
      discount: i.discount,
      total: i.total,
    })),
  }
}
```

**ORDER_FORM case:**
Use `getOrder(entityId)`. Map:
```typescript
case "ORDER_FORM": {
  const order = await getOrder(entityId)
  return {
    storeId: order.storeId,
    data: {
      storeName: order.storeName,
      number: order.number,
      date: order.createdAt,
      sellerName: order.sellerName,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      clientEmail: order.clientEmail ?? "",
      totalAmount: order.totalAmount,
      prepaidAmount: order.prepaidAmount,
      remainingAmount: order.totalAmount - order.prepaidAmount,
      estimatedDays: order.estimatedDays ?? "",
    },
    items: order.items.map(i => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      total: i.price * i.quantity,
    })),
  }
}
```

**RECEIVE_DOC case:**
Direct DB query (same pattern as current print page `src/app/(dashboard)/print/receive/[id]/page.tsx`):
```typescript
case "RECEIVE_DOC": {
  const receive = await db.stockReceive.findUnique({
    where: { id: entityId },
    include: {
      store: { select: { name: true } },
      supplier: { select: { name: true } },
      receivedBy: { select: { firstName: true, lastName: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  })
  if (!receive) throw new Error("Приходная накладная не найдена")
  return {
    storeId: receive.storeId,
    data: {
      storeName: receive.store.name,
      supplierName: receive.supplier?.name ?? "",
      number: receive.number,
      date: receive.createdAt.toISOString(),
      receivedByName: `${receive.receivedBy.firstName} ${receive.receivedBy.lastName}`,
      totalAmount: Number(receive.totalAmount),
    },
    items: receive.items.map(i => ({
      productName: i.product.name,
      quantity: i.quantity,
      costPrice: Number(i.costPrice),
      total: Number(i.costPrice) * i.quantity,
    })),
  }
}
```

**WRITE_OFF_DOC case:**
Direct DB query (same as current `src/app/(dashboard)/print/write-off/[id]/page.tsx`):
```typescript
case "WRITE_OFF_DOC": {
  const writeOff = await db.stockWriteOff.findUnique({
    where: { id: entityId },
    include: {
      store: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  })
  if (!writeOff) throw new Error("Акт списания не найден")
  const storeId = writeOff.storeId
  const items = writeOff.items.map(i => ({
    productName: i.product.name,
    quantity: i.quantity,
    costPrice: Number(i.costPrice),
    total: Number(i.costPrice) * i.quantity,
  }))
  return {
    storeId,
    data: {
      storeName: writeOff.store.name,
      number: writeOff.number,
      date: writeOff.createdAt.toISOString(),
      reason: writeOff.reason,
      createdByName: `${writeOff.createdBy.firstName} ${writeOff.createdBy.lastName}`,
      totalAmount: items.reduce((sum, i) => sum + i.total, 0),
    },
    items,
  }
}
```

**REPAIR_RECEIPT case:**
Use `getRepair(entityId)`:
```typescript
case "REPAIR_RECEIPT": {
  const repair = await getRepair(entityId)
  return {
    storeId: repair.storeId,
    data: {
      storeName: repair.storeName,
      number: repair.number,
      date: repair.createdAt,
      createdByName: repair.createdByName,
      clientName: repair.clientName,
      clientPhone: repair.clientPhone,
      deviceInfo: [repair.deviceType, repair.deviceBrand, repair.deviceModel].filter(Boolean).join(" "),
      deviceSerial: repair.deviceSerial ?? "",
      deviceCondition: repair.deviceCondition,
      defectDescription: repair.defectDescription,
      estimatedCost: repair.estimatedCost ?? "",
    },
    items: [],
  }
}
```

**REPAIR_DELIVERY case:**
Use `getRepair(entityId)`:
```typescript
case "REPAIR_DELIVERY": {
  const repair = await getRepair(entityId)
  const totalPaid = repair.totalPaid
  const remaining = (repair.finalCost ?? 0) - totalPaid
  return {
    storeId: repair.storeId,
    data: {
      storeName: repair.storeName,
      number: repair.number,
      date: repair.createdAt,
      completedDate: repair.completedAt ?? "",
      clientName: repair.clientName,
      clientPhone: repair.clientPhone,
      deviceInfo: [repair.deviceType, repair.deviceBrand, repair.deviceModel].filter(Boolean).join(" "),
      deviceSerial: repair.deviceSerial ?? "",
      workDone: repair.workDone ?? "",
      finalCost: repair.finalCost ?? "",
      totalPaid,
      remainingAmount: remaining > 0 ? remaining : "",
      warrantyDays: repair.warrantyDays ?? "",
      warrantyUntil: repair.warrantyUntil ?? "",
    },
    items: [],
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/document-templates.ts
git commit -m "feat: add getDefaultTemplate and getDocumentData for all 6 document types"
```

---

## Chunk 4: Editor UI — List Page

### Task 8: Settings Nav + List Page

**Files:**
- Modify: `src/components/settings/settings-nav.tsx`
- Create: `src/app/(dashboard)/settings/document-templates/page.tsx`
- Create: `src/app/(dashboard)/settings/document-templates/document-templates-client.tsx`
- Create: `src/components/documents/template-table.tsx`

- [ ] **Step 1: Add "Документы" nav item to settings-nav.tsx**

In `src/components/settings/settings-nav.tsx`:
- Add `FileText` to the lucide-react import
- After the "Ценники" block (line ~46), add:

```typescript
  if (permissions.includes("settings.templates")) {
    items.push({
      title: "Документы",
      href: "/settings/document-templates",
      icon: FileText,
    })
  }
```

- [ ] **Step 2: Create template-table.tsx**

Follow the exact pattern from `src/components/price-labels/template-table.tsx`. Differences:
- Shows `type` column (using `DOCUMENT_TYPE_LABELS` for Russian text)
- Actions: duplicate, set default, delete (default cannot be deleted)
- Create dialog has a type selector (Select) + name input
- Group/filter by document type (optional tabs or just a column)
- "Создать шаблон" button at top

The component receives `templates` and `storeId` as props, calls server actions from `src/actions/document-templates.ts`.

- [ ] **Step 3: Create the server page.tsx**

Follow `src/app/(dashboard)/settings/price-labels/page.tsx` pattern:
```typescript
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { DocumentTemplatesClient } from "./document-templates-client"

export default async function DocumentTemplatesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return <DocumentTemplatesClient />
}
```

- [ ] **Step 4: Create the client wrapper**

Follow `src/app/(dashboard)/settings/price-labels/price-labels-client.tsx` pattern:
```typescript
"use client"

import { useCurrentStore } from "@/hooks/use-current-store"
import { TemplateTable } from "@/components/documents/template-table"

export function DocumentTemplatesClient() {
  const { currentStoreId } = useCurrentStore()
  if (!currentStoreId) return null
  return <TemplateTable storeId={currentStoreId} />
}
```

- [ ] **Step 5: Verify build and navigation**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/settings-nav.tsx src/app/(dashboard)/settings/document-templates/ src/components/documents/template-table.tsx
git commit -m "feat: add document templates list page with CRUD table"
```

---

## Chunk 5: Editor UI — Editor Page

### Task 9: Block List + Block Settings Components

**Files:**
- Create: `src/components/documents/block-list.tsx`
- Create: `src/components/documents/block-settings/index.tsx` — dispatcher by block type
- Create: `src/components/documents/block-settings/text-heading-settings.tsx` — shared settings for text + heading
- Create: `src/components/documents/block-settings/key-value-settings.tsx`
- Create: `src/components/documents/block-settings/table-settings.tsx`
- Create: `src/components/documents/block-settings/signatures-settings.tsx`
- Create: `src/components/documents/block-settings/panel-settings.tsx`
- Create: `src/components/documents/block-settings/simple-settings.tsx` — divider, spacer, image (small forms)

- [ ] **Step 1: Create block-list.tsx — drag-and-drop block list**

Uses `@hello-pangea/dnd` (same as price labels zone editor). Each block rendered as a card:
- Drag handle on left (GripVertical icon)
- Block type label + icon
- Click to expand/collapse inline settings
- Delete button (Trash2 icon)
- "Добавить блок" button at bottom with a DropdownMenu listing all block types

Props:
```typescript
interface BlockListProps {
  blocks: DocumentBlock[]
  documentType: DocumentType
  onChange: (blocks: DocumentBlock[]) => void
}
```

On drag end, reorder the blocks array and call `onChange`. On add, insert a new block with sensible defaults at the end. On delete, remove by id.

Block type icons (from lucide-react):
- text: `Type`
- heading: `Heading`
- keyValue: `List`
- table: `Table`
- signatures: `PenLine`
- divider: `Minus`
- image: `Image`
- spacer: `Space`
- panel: `PanelTop`

- [ ] **Step 2: Create block-settings directory — inline settings per block type**

Split into per-block-type files to keep each under ~200 lines. `index.tsx` exports `BlockSettings` component that dispatches to the correct sub-component by `block.type`:

**Common (all blocks):**
- showIf condition editor: optional section with field input, op selector, value input

**Text / Heading:**
- Content textarea
- Variable hint: list of available `{{variables}}` from `DOCUMENT_TYPE_CONFIGS[documentType].variables`, rendered as clickable badges below the textarea. On click, insert `{{variableName}}` at cursor position (or append to content)
- fontSize (number input), fontWeight (Select), textAlign (ToggleGroup or RadioGroup with AlignLeft/AlignCenter/AlignRight icons)

**KeyValue:**
- List of label-value pairs. Each pair: label input + value input + delete button. Value input gets the same variable hint as text blocks
- Add pair button
- Layout toggle: stacked / inline (RadioGroup)
- fontSize

**Table:**
- Checkbox list of available columns from `DOCUMENT_TYPE_CONFIGS[documentType].tableColumns`
- For each enabled column: header text input, width input, alignment select
- Toggle: showRowNumbers, showTotal
- If showTotal: totalLabel input
- fontSize

**Signatures:**
- List of signature items: label input + name input (with variable hint) + delete button
- Add signature button
- showDate toggle

**Panel:**
- Border toggle (Switch), padding (number input)
- Recursive block list for children (reuse BlockList component, but exclude "panel" from add options)

**Divider:** style select (solid/dashed), margin number input
**Spacer:** height number input
**Image:** src URL input, maxHeight number input, align select

Props:
```typescript
interface BlockSettingsProps {
  block: DocumentBlock
  documentType: DocumentType
  onChange: (block: DocumentBlock) => void
}
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/documents/block-list.tsx src/components/documents/block-settings/
git commit -m "feat: add block list with drag-drop and inline block settings"
```

---

### Task 10: Editor Page

**Files:**
- Create: `src/app/(dashboard)/settings/document-templates/[id]/page.tsx`
- Create: `src/app/(dashboard)/settings/document-templates/[id]/editor-client.tsx`

- [ ] **Step 1: Create the server page**

```typescript
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getDocumentTemplate } from "@/actions/document-templates"
import { EditorClient } from "./editor-client"

interface EditorPageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentTemplateEditorPage({ params }: EditorPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const template = await getDocumentTemplate(id)

  return <EditorClient template={template} />
}
```

- [ ] **Step 2: Create the editor client**

Two-column layout:
- Left (40%): Template header (name input, type badge, save/back buttons) + BlockList + global settings (pageMargin, fontFamily)
- Right (60%): Live A4 preview using `DocumentRenderer` with demo data from `DEMO_DATA[template.type]`

State management:
- `layout` state initialized from `template.layout as unknown as DocumentLayout` (Prisma Json double-cast)
- `name` state from `template.name`
- `saving` state with `useTransition`
- On save: call `updateDocumentTemplate(template.id, { name, layout })`

Preview updates live as blocks are edited (controlled state passed to `DocumentRenderer`).

Scale the preview: use a wrapper div that constrains width and `DocumentRenderer` with `scale` prop calculated from container width / A4 width.

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/document-templates/[id]/
git commit -m "feat: add document template editor page with live preview"
```

---

## Chunk 6: Default Templates Seed + Print Page Migration

### Task 11: Default Template Layouts + Seed

**Files:**
- Create: `src/lib/default-document-templates.ts`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Create default template layouts**

File `src/lib/default-document-templates.ts` — exports a function `getDefaultLayouts()` returning `Record<DocumentType, DocumentLayout>`. Each layout replicates the exact structure of the current hardcoded print component.

Derive each layout by examining the corresponding print component:

**SALE_RECEIPT** (from `src/components/print/sale-receipt.tsx`):
```typescript
{
  blocks: [
    { id: "1", type: "heading", content: "{{storeName}}", fontSize: 16, fontWeight: "bold", textAlign: "center" },
    { id: "2", type: "text", content: "{{storeAddress}}", fontSize: 12, fontWeight: "normal", textAlign: "center", showIf: { field: "storeAddress", op: "exists" } },
    { id: "3", type: "text", content: "Тел: {{storePhone}}", fontSize: 12, fontWeight: "normal", textAlign: "center", showIf: { field: "storePhone", op: "exists" } },
    { id: "4", type: "heading", content: "ТОВАРНЫЙ ЧЕК №{{number}}", fontSize: 14, fontWeight: "bold", textAlign: "center" },
    { id: "5", type: "keyValue", items: [
      { label: "Дата", value: "{{date}}" },
      { label: "Продавец", value: "{{sellerName}}" },
    ], fontSize: 12, layout: "stacked" },
    { id: "6", type: "table", columns: [
      { key: "productName", header: "Наименование", width: "auto", align: "left" },
      { key: "quantity", header: "Кол-во", width: "50px", align: "center" },
      { key: "price", header: "Цена", width: "90px", align: "right" },
      { key: "discount", header: "Скидка", width: "80px", align: "right" },
      { key: "total", header: "Сумма", width: "90px", align: "right" },
    ], showRowNumbers: true, showTotal: false, totalLabel: "Итого", fontSize: 11 },
    { id: "7", type: "keyValue", items: [
      { label: "Итого", value: "{{totalAmount}}" },
      { label: "Скидка", value: "{{discountAmount}}", showIf: { field: "discountAmount", op: "gt", value: 0 } },
      { label: "К ОПЛАТЕ", value: "{{finalAmount}}" },
    ], fontSize: 12, layout: "stacked" },
    { id: "8", type: "text", content: "{{paymentMethods}}", fontSize: 12, fontWeight: "bold", textAlign: "left" },
    { id: "9", type: "text", content: "Спасибо за покупку!", fontSize: 12, fontWeight: "normal", textAlign: "center" },
  ],
  pageMargin: 10,
  fontFamily: "serif",
}
```

Create similar layouts for all 6 types, matching the structure of each existing print component. Use stable IDs (e.g., "sr-1", "sr-2" for sale receipt, "of-1", "of-2" for order form, etc.).

**For the remaining 5 types:** Derive the full block JSON layout by reading the corresponding print component source file line by line and translating each visual element into the appropriate block type. The summaries below are advisory guides — the source files are authoritative:

**ORDER_FORM** — read `src/components/print/order-receipt.tsx`: heading (store name), heading (title), keyValue (date, seller), heading "Клиент:", keyValue (ФИО, Телефон, E-mail with `showIf: { field: "clientEmail", op: "exists" }`), table (name, qty, price, total + row numbers), keyValue totals (Итого bold, Предоплата, Остаток with `showIf: { field: "remainingAmount", op: "gt", value: 0 }`), text estimated days with `showIf: { field: "estimatedDays", op: "exists" }`, signatures (Продавец, Клиент)

**RECEIVE_DOC** — read `src/components/print/inventory-receive-doc.tsx`: heading (title), keyValue (Дата, Магазин, Поставщик with `showIf: { field: "supplierName", op: "exists" }`), table (productName, qty, costPrice, total + row numbers + showTotal), signatures (Принял with `{{receivedByName}}`, Сдал)

**WRITE_OFF_DOC** — read `src/components/print/write-off-doc.tsx`: heading (title), keyValue (Дата, Магазин, Причина), table (productName, qty, costPrice, total + row numbers + showTotal), signatures (Составил with `{{createdByName}}`, Утвердил)

**REPAIR_RECEIPT** — read `src/components/print/repair-receipt.tsx`: heading (store), heading (title), keyValue (Дата, Приёмщик), heading "Клиент:", keyValue (ФИО, Телефон), heading "Устройство:", keyValue (deviceInfo, Серийный номер with `showIf: { field: "deviceSerial", op: "exists" }`, Состояние), heading "Описание неисправности:", text (`{{defectDescription}}`), keyValue (Оценка стоимости with `showIf: { field: "estimatedCost", op: "exists" }`), divider, text (disclaimer, fontSize: 10), signatures (Приёмщик, Клиент)

**REPAIR_DELIVERY** — read `src/components/print/repair-delivery.tsx`: heading (store), heading (title), keyValue (Дата приёмки, Дата выполнения with `showIf`), heading "Клиент:", keyValue (ФИО, Телефон), heading "Устройство:", keyValue (deviceInfo, Серийный номер with showIf), text (workDone with `showIf: { field: "workDone", op: "exists" }`), heading "Стоимость:", keyValue (Итого with showIf, Оплачено, К доплате with `showIf: { field: "remainingAmount", op: "gt", value: 0 }`), panel with border for warranty card (all wrapped in `showIf: { field: "warrantyDays", op: "exists" }`) containing: heading "ГАРАНТИЙНЫЙ ТАЛОН" center 14px, keyValue (Устройство, Серийный номер, Срок гарантии, Гарантия до with showIf), text (disclaimer fontSize 10), signatures (Выдал, Клиент)

- [ ] **Step 2: Add seeding to prisma/seed.ts**

After the suppliers section (around line 373), add a new section:

```typescript
// =============================================
// 9. Default Document Templates
// =============================================
console.log("Document templates...")
import { getDefaultLayouts } from "../src/lib/default-document-templates"
import { DOCUMENT_TYPES } from "../src/lib/validations/document-templates"

const defaultLayouts = getDefaultLayouts()
let templateCount = 0

for (const store of stores) {
  for (const docType of DOCUMENT_TYPES) {
    const existing = await prisma.documentTemplate.findFirst({
      where: { storeId: store.id, type: docType, isDefault: true },
    })
    if (!existing) {
      await prisma.documentTemplate.create({
        data: {
          storeId: store.id,
          name: DOCUMENT_TYPE_LABELS[docType],
          type: docType,
          layout: defaultLayouts[docType] as object,
          isDefault: true,
          createdById: admin.id,
        },
      })
      templateCount++
    }
  }
}
console.log(`  ${templateCount} default document templates`)
```

Note: Import `DOCUMENT_TYPE_LABELS` from `src/lib/validations/document-templates` and `DOCUMENT_TYPES` as well. Use static imports at the top of seed.ts.

- [ ] **Step 3: Run seed to verify**

```bash
npx prisma db seed
```

Expected: "Document templates... 18 default document templates" (6 types × 3 stores)

- [ ] **Step 4: Commit**

```bash
git add src/lib/default-document-templates.ts prisma/seed.ts
git commit -m "feat: add default document template layouts and seed them per store"
```

---

### Task 12: Migrate Print Pages

**Files:**
- Modify: `src/app/(dashboard)/print/sale/[id]/page.tsx`
- Modify: `src/app/(dashboard)/print/order/[id]/page.tsx`
- Modify: `src/app/(dashboard)/print/receive/[id]/page.tsx`
- Modify: `src/app/(dashboard)/print/write-off/[id]/page.tsx`
- Modify: `src/app/(dashboard)/print/repair-receipt/[id]/page.tsx`
- Modify: `src/app/(dashboard)/print/repair-delivery/[id]/page.tsx`

- [ ] **Step 1: Migrate all 6 print pages**

Each page follows the same pattern. Replace the old component import + data mapping with:

```typescript
import { getDefaultTemplate, getDocumentData } from "@/actions/document-templates"
import { DocumentRenderer } from "@/components/documents/document-renderer"
import type { DocumentLayout } from "@/lib/validations/document-templates"
```

New page body (example for sale). Note: `getDocumentData` returns `{ storeId, data, items }` — the storeId comes from the entity, so print pages don't need session storeId:

```typescript
export default async function PrintSalePage({ params }: PrintSalePageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const docData = await getDocumentData("SALE_RECEIPT", id)
  const template = await getDefaultTemplate(docData.storeId, "SALE_RECEIPT")
  const layout = template.layout as unknown as DocumentLayout

  return (
    <PrintLayout title={`Товарный чек ${docData.data.number}`}>
      <DocumentRenderer
        layout={layout}
        data={docData.data}
        items={docData.items}
        documentType="SALE_RECEIPT"
      />
    </PrintLayout>
  )
}
```

Apply this pattern to all 6 pages with the correct `DocumentType`:
- `print/sale/[id]` → `SALE_RECEIPT`, title: `Товарный чек`
- `print/order/[id]` → `ORDER_FORM`, title: `Бланк заказа`
- `print/receive/[id]` → `RECEIVE_DOC`, title: `Приходная накладная`
- `print/write-off/[id]` → `WRITE_OFF_DOC`, title: `Акт списания`
- `print/repair-receipt/[id]` → `REPAIR_RECEIPT`, title: `Акт приёмки`
- `print/repair-delivery/[id]` → `REPAIR_DELIVERY`, title: `Акт выдачи`

For repair-delivery, keep the `status !== "DELIVERED"` check. Call `getRepair(id)` first to check status, then proceed with `getDocumentData`.

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/print/
git commit -m "feat: migrate all 6 print pages to use DocumentRenderer with templates"
```

---

### Task 13: Delete Old Print Components

**Files:**
- Delete: `src/components/print/sale-receipt.tsx`
- Delete: `src/components/print/order-receipt.tsx`
- Delete: `src/components/print/inventory-receive-doc.tsx`
- Delete: `src/components/print/write-off-doc.tsx`
- Delete: `src/components/print/repair-receipt.tsx`
- Delete: `src/components/print/repair-delivery.tsx`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -r "sale-receipt\|order-receipt\|inventory-receive-doc\|write-off-doc\|repair-receipt\|repair-delivery" src/ --include="*.tsx" --include="*.ts" -l
```

Expected: No files (all imports were replaced in Task 12).

- [ ] **Step 2: Delete the files**

```bash
rm src/components/print/sale-receipt.tsx
rm src/components/print/order-receipt.tsx
rm src/components/print/inventory-receive-doc.tsx
rm src/components/print/write-off-doc.tsx
rm src/components/print/repair-receipt.tsx
rm src/components/print/repair-delivery.tsx
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add -u src/components/print/
git commit -m "chore: remove old hardcoded print components (replaced by document constructor)"
```

---

### Task 14: Store Creation Hook

**Files:**
- Modify: `src/actions/stores.ts`

- [ ] **Step 1: Check if there's a store creation action**

The current `src/actions/stores.ts` only has `getUserStores()`. Look for store creation in settings actions:

```bash
grep -r "store.create\|createStore\|prisma.store.create" src/ --include="*.ts" --include="*.tsx" -l
```

If a store creation action exists, add a call to seed default document templates after creating the store. If store creation happens in the admin/settings UI, modify that action.

If no creation action exists yet (stores are seed-only), add a note/comment for future implementation:

```typescript
// TODO: When store creation action is added, call seedDefaultDocumentTemplates(storeId)
```

Create a reusable function in `src/actions/document-templates.ts`:

```typescript
export async function seedDefaultDocumentTemplates(storeId: string, createdById: string) {
  const { getDefaultLayouts } = await import("@/lib/default-document-templates")
  const defaultLayouts = getDefaultLayouts()

  for (const docType of DOCUMENT_TYPES) {
    const existing = await db.documentTemplate.findFirst({
      where: { storeId, type: docType, isDefault: true },
    })
    if (!existing) {
      await db.documentTemplate.create({
        data: {
          storeId,
          name: DOCUMENT_TYPE_LABELS[docType],
          type: docType,
          layout: defaultLayouts[docType] as object,
          isDefault: true,
          createdById,
        },
      })
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/document-templates.ts src/actions/stores.ts
git commit -m "feat: add seedDefaultDocumentTemplates for new store creation"
```

---

## Chunk 7: Final Verification

### Task 15: End-to-End Verification

- [ ] **Step 1: Run the dev server**

```bash
cd astore-erp && npm run dev
```

- [ ] **Step 2: Verify settings navigation**

Navigate to `/settings` — "Документы" should appear in the sidebar (if user has `settings.templates` permission).

- [ ] **Step 3: Verify template list**

Navigate to `/settings/document-templates` — should show default templates (6 per store, seeded).

- [ ] **Step 4: Verify editor**

Click a template to open the editor. Left panel should show the block list, right panel should show the live A4 preview with demo data.

- [ ] **Step 5: Verify print pages**

Navigate to `/print/sale/[id]` (use an existing sale ID from the app). The document should render using the default template via DocumentRenderer.

- [ ] **Step 6: Verify build**

```bash
npx next build
```

Expected: Build succeeds with no errors.
