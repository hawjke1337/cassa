# Document Constructor — Design Spec

## Overview

Block-based visual document template constructor for a:store ERP. Replaces 6 hardcoded print components with a unified render engine driven by JSON template layouts stored in PostgreSQL.

**Document types:** Sale Receipt, Order Form, Receive Doc, Write-off Doc, Repair Receipt, Repair Delivery.

**Key decisions:**
- Block-based layout (ordered list of typed blocks, vertical flow, drag-and-drop reorder)
- Placeholder variables with conditional block visibility (`showIf`)
- Unified `DocumentRenderer` for both editor preview and print pages
- Default templates (via seed) replicate current hardcoded layouts; old components removed after migration
- Reuses existing `settings.templates` permission and `PrintLayout` wrapper

---

## 1. Data Model

### 1.1 Prisma Model

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

Relations to add:
- `Store`: `documentTemplates DocumentTemplate[]`
- `User`: `documentTemplates DocumentTemplate[] @relation("DocumentTemplateCreatedBy")`

### 1.2 Layout JSON Structure

```typescript
interface DocumentLayout {
  blocks: DocumentBlock[]
  pageMargin: number     // mm, default 10
  fontFamily: "serif" | "sans-serif"  // default "serif"
}

type DocumentBlock =
  | TextBlock
  | HeadingBlock
  | KeyValueBlock
  | TableBlock
  | SignaturesBlock
  | DividerBlock
  | ImageBlock
  | SpacerBlock
  | PanelBlock

interface BaseBlock {
  id: string             // crypto.randomUUID()
  type: string
  showIf?: ShowIfCondition | null
}

interface ShowIfCondition {
  field: string          // variable name, e.g. "discount"
  op: "exists" | "gt" | "eq"  // exists = not null/empty, gt = greater than, eq = equals
  value?: number | string      // for "gt" and "eq" operators
}

interface TextBlock extends BaseBlock {
  type: "text"
  content: string        // supports {{placeholders}}
  fontSize: number       // px, default 12
  fontWeight: "normal" | "bold"
  textAlign: "left" | "center" | "right"
}

interface HeadingBlock extends BaseBlock {
  type: "heading"
  content: string
  fontSize: number       // px, default 16
  fontWeight: "normal" | "bold"  // default "bold"
  textAlign: "left" | "center" | "right"  // default "center"
}

interface KeyValueBlock extends BaseBlock {
  type: "keyValue"
  items: Array<{
    label: string        // e.g. "Дата"
    value: string        // e.g. "{{date}}" — supports placeholders
    showIf?: ShowIfCondition | null  // item-level conditional visibility
  }>
  fontSize: number       // default 12
  layout: "stacked" | "inline"  // stacked = one per line, inline = side by side
}

interface TableBlock extends BaseBlock {
  type: "table"
  columns: Array<{
    key: string          // field name from items, e.g. "productName"
    header: string       // column header text, e.g. "Наименование"
    width: string        // CSS width, e.g. "40%", "90px"
    align: "left" | "center" | "right"
  }>
  showRowNumbers: boolean   // add "№" column
  showTotal: boolean        // add totals row
  totalLabel: string        // e.g. "Итого"
  fontSize: number          // default 11
}

interface SignaturesBlock extends BaseBlock {
  type: "signatures"
  items: Array<{
    label: string        // e.g. "Продавец"
    name: string         // placeholder, e.g. "{{sellerName}}" or empty for blank line
  }>
  showDate: boolean
}

interface DividerBlock extends BaseBlock {
  type: "divider"
  style: "solid" | "dashed"
  margin: number         // px, top and bottom margin
}

interface ImageBlock extends BaseBlock {
  type: "image"
  src: string            // URL
  maxHeight: number      // px
  align: "left" | "center" | "right"
}

interface SpacerBlock extends BaseBlock {
  type: "spacer"
  height: number         // px
}

interface PanelBlock extends BaseBlock {
  type: "panel"
  border: boolean        // show border around panel
  padding: number        // px, inner padding, default 12
  children: DocumentBlock[]  // nested blocks (max 1 level — children cannot be PanelBlocks)
}
```

### 1.3 Zod Validation

All block types validated with Zod schemas. `createDocumentTemplateSchema` and `updateDocumentTemplateSchema` for server action input validation.

---

## 2. Variable System

### 2.1 Variable Sets Per Document Type

Each document type has a fixed set of available variables. Variables are resolved from document data at render time.

**SALE_RECEIPT:**
- `storeName`, `storeAddress`, `storePhone` — store info
- `number`, `date`, `sellerName` — document meta
- `totalAmount`, `discountAmount`, `finalAmount` — financials
- `paymentMethods` — formatted payment string (e.g. "Наличные: 5 000 ₽, Карта: 3 000 ₽")
- Payment items (secondary table source): `payments[]` with fields `method`, `amount` — allows rendering individual payment lines via a second TableBlock or KeyValueBlock with `{{paymentMethods}}`
- Table item fields: `productName`, `productSku`, `quantity`, `price`, `discount`, `total`

**ORDER_FORM:**
- `storeName` — store info
- `number`, `date`, `sellerName` — document meta
- `clientName`, `clientPhone`, `clientEmail` — client info
- `totalAmount`, `prepaidAmount`, `remainingAmount` — financials
- `estimatedDays` — delivery estimate
- Table item fields: `name`, `quantity`, `price`, `total`

**RECEIVE_DOC:**
- `storeName`, `supplierName` — parties
- `number`, `date`, `receivedByName` — document meta
- `totalAmount` — financial
- Table item fields: `productName`, `quantity`, `costPrice`, `total`

**WRITE_OFF_DOC:**
- `storeName` — store info
- `number`, `date`, `reason`, `createdByName` — document meta
- `totalAmount` — financial
- Table item fields: `productName`, `quantity`, `costPrice`, `total`

**REPAIR_RECEIPT:**
- `storeName` — store info
- `number`, `date`, `createdByName` — document meta
- `clientName`, `clientPhone` — client info
- `deviceInfo` — formatted string (type + brand + model)
- `deviceSerial`, `deviceCondition`, `defectDescription` — device details
- `estimatedCost` — financial
- No table (form-based document)

**REPAIR_DELIVERY:**
- `storeName` — store info
- `number`, `date`, `completedDate` — document meta
- `clientName`, `clientPhone` — client info
- `deviceInfo`, `deviceSerial` — device details
- `workDone` — repair description
- `finalCost`, `totalPaid`, `remainingAmount` — financials
- `warrantyDays`, `warrantyUntil` — warranty info
- No table (form-based document)

### 2.2 Variable Resolution

Variables in text content like `"Товарный чек №{{number}} от {{date}}"` are resolved by:
1. Parsing `{{variableName}}` patterns from content string
2. Looking up `variableName` in the document data object
3. Auto-formatting: money fields through `formatMoney()`, date fields through `formatDate()`
4. Unknown variables rendered as `{{variableName}}` (visible in editor preview as placeholder)

### 2.3 Conditional Visibility

**Block-level:** Blocks with `showIf` are evaluated against document data:
- `{ field: "discount", op: "gt", value: 0 }` — show only if discount > 0
- `{ field: "clientEmail", op: "exists" }` — show only if email is not null/empty
- `showIf: null` or omitted — always visible

**Item-level:** `KeyValueBlock` items also support `showIf` for conditional rows within a single block. This allows a totals section like "Итого / Скидка (if > 0) / К ОПЛАТЕ" as one KeyValueBlock instead of three separate blocks.

### 2.4 Computed Fields

Table item `total` fields are computed by the resolver (not stored in DB): `total = price * quantity` or `total = costPrice * quantity` depending on document type. Money fields are auto-formatted through `formatMoney()`, date fields through `formatDate()`. The `document-variables.ts` file defines which fields are money/date for auto-formatting.

---

## 3. Document Renderer

### 3.1 `DocumentRenderer` Component

Single client component (`src/components/documents/document-renderer.tsx`) used in:
- Editor preview (with demo data, scaled down)
- Print pages (with real data, full A4 size)

**Props:**
```typescript
interface DocumentRendererProps {
  layout: DocumentLayout
  data: Record<string, unknown>  // document variables
  items?: Record<string, unknown>[]  // table items (if applicable)
  scale?: number       // for editor preview, default 1
  preview?: boolean    // show placeholder text for empty variables
}
```

### 3.2 Block Renderers

Each block type has a dedicated render function:
- `renderTextBlock` — parses `{{var}}` placeholders, applies styles
- `renderHeadingBlock` — same as text but with heading styles
- `renderKeyValueBlock` — renders label: value pairs in stacked or inline layout
- `renderTableBlock` — renders HTML table with configured columns, optional row numbers and totals
- `renderSignaturesBlock` — renders signature lines with underscores
- `renderDividerBlock` — renders `<hr>` with configured style
- `renderImageBlock` — renders `<img>` with max-height constraint
- `renderSpacerBlock` — renders empty div with configured height
- `renderPanelBlock` — renders bordered container, recursively renders children (max 1 level deep — PanelBlock children cannot be PanelBlocks)

### 3.3 Table Auto-Pagination

For print mode, tables that overflow the page use CSS `break-inside: avoid` on rows and `thead { display: table-header-group }` to repeat headers across pages. Browser print engine handles pagination natively.

### 3.4 Print Styling

Reuses existing CSS classes from `globals.css` (`.print-document`, `.print-table`, etc.). The renderer outputs HTML using these classes, keeping visual consistency with current documents.

---

## 4. Editor UI

### 4.1 Pages

**Template list page:** `/settings/document-templates`
- Table with columns: Name, Type (localized), Default star, Created date, Actions
- "Создать шаблон" button opens dialog to select type + name
- Actions: duplicate, set default, delete (default cannot be deleted)
- Grouped/filtered by document type

**Editor page:** `/settings/document-templates/[id]`
- Two-column layout:
  - Left (40%): Block list with drag-and-drop (@hello-pangea/dnd), add block button, inline block settings
  - Right (60%): Live A4 preview using `DocumentRenderer` with demo data

### 4.2 Block List Panel

- Each block shown as a card with icon + type label
- Click to expand inline settings panel
- Drag handle on left side for reordering
- Delete button per block
- "Добавить блок" button at bottom with dropdown to select block type

### 4.3 Block Settings (inline, expanded)

**Common settings (all blocks):** showIf condition editor (optional)

**Text/Heading:**
- Content textarea with variable autocomplete hint (list of available `{{variables}}`)
- fontSize, fontWeight, textAlign

**KeyValue:**
- List of label-value pairs (add/remove)
- layout toggle (stacked/inline)
- fontSize

**Table:**
- Checkbox list of available columns (depends on document type)
- Per-column: header text, width, alignment
- Toggles: showRowNumbers, showTotal
- fontSize

**Signatures:**
- List of signature labels (add/remove)
- Per-signature: optional name placeholder (e.g. `{{sellerName}}`)
- showDate toggle

**Panel:** border toggle, padding, nested block list (recursive editor)

**Image:** src URL input (external URLs only — no file upload in MVP), maxHeight, align
**Divider:** style (solid/dashed), margin
**Spacer:** height

**Variable hint:** A reference list of available `{{variables}}` shown below text/content inputs, not an autocomplete dropdown. Variables are clickable to insert.

### 4.4 Template Header

- Template name (editable input)
- Document type (read-only badge, set at creation)
- Save button
- Back button to list

---

## 5. Server Actions

File: `src/actions/document-templates.ts`

### 5.1 Template CRUD

- `getDocumentTemplates(storeId)` — list all templates for store, ordered by type then name
- `getDocumentTemplate(id)` — single template with store name for editor
- `createDocumentTemplate({ storeId, name, type, layout })` — create with permission check
- `updateDocumentTemplate(id, { name, layout })` — update (type immutable)
- `deleteDocumentTemplate(id)` — delete (cannot delete if isDefault)
- `duplicateDocumentTemplate(id)` — copy with "Копия — " prefix
- `setDefaultDocumentTemplate(id)` — set as default (unset other defaults for same `type` AND `storeId` in a single transaction — must scope by both, unlike price labels which have no type dimension)

### 5.2 Document Data

- `getDefaultTemplate(storeId, type)` — get the default template for a document type (used by print pages)
- `getDocumentData(type, entityId, storeId)` — loads entity from DB, maps to flat variable object + items array. Switch by document type to query the right tables.

All actions require `settings.templates` permission for CRUD, but `getDefaultTemplate` and `getDocumentData` require only the relevant module permission (e.g., `pos.view` for sale receipts).

---

## 6. Print Page Migration

### 6.1 Strategy

Each existing print page (`/print/sale/[id]`, `/print/order/[id]`, etc.) is refactored to:
1. Load entity data via `getDocumentData(type, id, storeId)`
2. Load template via `getDefaultTemplate(storeId, type)`
3. Render via `DocumentRenderer` wrapped in `PrintLayout`

### 6.2 Deleted Files (after migration)

- `src/components/print/sale-receipt.tsx`
- `src/components/print/order-receipt.tsx`
- `src/components/print/inventory-receive-doc.tsx`
- `src/components/print/write-off-doc.tsx`
- `src/components/print/repair-receipt.tsx`
- `src/components/print/repair-delivery.tsx`

### 6.3 Default Templates (Seed)

6 default template JSON layouts created in `prisma/seed.ts`, replicating the exact current layout of each document type. These are seeded per-store for each existing store.

**Note:** Default templates are `isDefault: true` and cannot be deleted. They serve as the baseline — users can create additional templates but each type always has at least one.

---

## 7. Navigation & Permissions

### 7.1 Settings Nav

Add "Документы" item to `settings-nav.tsx`:
- Icon: `FileText` from lucide-react
- Permission: `settings.templates` (same as price labels)
- Path: `/settings/document-templates`

### 7.2 Settings Layout

`settings.templates` already in the access check (added with price labels).

---

## 8. File Structure

### New Files
- `src/lib/validations/document-templates.ts` — Zod schemas, TypeScript interfaces, block types
- `src/lib/document-variables.ts` — variable definitions per document type, demo data, money/date field lists
- `src/actions/document-templates.ts` — server actions (CRUD + data loading)
- `src/components/documents/document-renderer.tsx` — unified block renderer
- `src/components/documents/block-renderers.tsx` — individual block render functions
- `src/components/documents/template-table.tsx` — template list with CRUD
- `src/components/documents/block-list.tsx` — drag-and-drop block list for editor
- `src/components/documents/block-settings.tsx` — inline settings panel per block type
- `src/app/(dashboard)/settings/document-templates/page.tsx` — list page (server)
- `src/app/(dashboard)/settings/document-templates/document-templates-client.tsx` — list page (client)
- `src/app/(dashboard)/settings/document-templates/[id]/page.tsx` — editor page (server)
- `src/app/(dashboard)/settings/document-templates/[id]/editor-client.tsx` — editor page (client)

### Modified Files
- `prisma/schema.prisma` — add `DocumentType` enum + `DocumentTemplate` model + relations
- `prisma/seed.ts` — add default template seeding
- `src/components/settings/settings-nav.tsx` — add "Документы" nav item
- `src/app/(dashboard)/print/sale/[id]/page.tsx` — use DocumentRenderer
- `src/app/(dashboard)/print/order/[id]/page.tsx` — use DocumentRenderer
- `src/app/(dashboard)/print/receive/[id]/page.tsx` — use DocumentRenderer
- `src/app/(dashboard)/print/write-off/[id]/page.tsx` — use DocumentRenderer
- `src/app/(dashboard)/print/repair-receipt/[id]/page.tsx` — use DocumentRenderer
- `src/app/(dashboard)/print/repair-delivery/[id]/page.tsx` — use DocumentRenderer
- `src/actions/stores.ts` — call `seedDefaultDocumentTemplates(storeId)` after store creation

### Deleted Files (after migration)
- `src/components/print/sale-receipt.tsx`
- `src/components/print/order-receipt.tsx`
- `src/components/print/inventory-receive-doc.tsx`
- `src/components/print/write-off-doc.tsx`
- `src/components/print/repair-receipt.tsx`
- `src/components/print/repair-delivery.tsx`

---

## 9. Edge Cases

- **No template exists for type:** Cannot happen — seed creates defaults. If somehow missing, print page shows error message.
- **Unknown variable in template:** Rendered as `{{variableName}}` literally — visible but not breaking.
- **Empty table (no items):** Show "Нет позиций" row.
- **Very long tables:** Browser print engine handles pagination via CSS `break-inside: avoid` on rows.
- **Template deletion:** Default templates cannot be deleted. Non-default can be deleted freely.
- **Store without templates:** Seed creates defaults for all existing stores. New stores get defaults via a call to `seedDefaultDocumentTemplates(storeId)` in the store creation action (`src/actions/stores.ts`).
