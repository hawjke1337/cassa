import { z } from "zod"

// ---- Document types ----

export const DOCUMENT_TYPES = [
  "SALE_RECEIPT",
  "ORDER_FORM",
  "RECEIVE_DOC",
  "WRITE_OFF_DOC",
  "REPAIR_RECEIPT",
  "REPAIR_DELIVERY",
  "TRADE_IN_CONTRACT",
  "RETURN_ACT",
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SALE_RECEIPT: "Товарный чек",
  ORDER_FORM: "Бланк заказа",
  RECEIVE_DOC: "Приходная накладная",
  WRITE_OFF_DOC: "Акт списания",
  REPAIR_RECEIPT: "Акт приёмки",
  REPAIR_DELIVERY: "Акт выдачи",
  TRADE_IN_CONTRACT: "Договор купли-продажи",
  RETURN_ACT: "Акт возврата",
}

// ---- Block type constants ----

export const BLOCK_TYPES = [
  "text",
  "heading",
  "keyValue",
  "table",
  "signatures",
  "divider",
  "image",
  "spacer",
  "panel",
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

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
