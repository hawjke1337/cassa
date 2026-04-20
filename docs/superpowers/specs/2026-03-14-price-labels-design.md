# Price Labels Constructor — Design Spec

## Goal

Visual zone-based price label template constructor with template saving, barcode support, and multi-point print triggers for a:store ERP.

## Architecture

Zone-based label layout: each label has 3 fixed zones (header, body, footer). Users add elements to zones from a predefined list, reorder via drag-and-drop, configure font/size/alignment. Templates saved to DB as JSON. Print renders labels on A4 grid via CSS `@media print`.

## Tech Stack

- Next.js App Router (server components + client editor)
- Prisma + PostgreSQL (PriceLabelTemplate model)
- JsBarcode (EAN-13 and Code128 SVG rendering)
- `qrcode.react` for QR code rendering
- shadcn/ui components, TailwindCSS
- `@hello-pangea/dnd` for drag-and-drop reordering within zones
- CSS mm units + `@media print` for accurate label sizing

---

## Data Model

### PriceLabelTemplate (new Prisma model)

```prisma
model PriceLabelTemplate {
  id          String   @id @default(cuid())
  storeId     String
  store       Store    @relation(fields: [storeId], references: [id])
  name        String
  width       Int      // mm, duplicated from layout for queryability
  height      Int      // mm, duplicated from layout for queryability
  layout      Json
  isDefault   Boolean  @default(false)
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Add `priceLabelTemplates PriceLabelTemplate[]` relation to `Store` and `User` models.

**Note:** `width`/`height` are stored both as columns (for filtering/display) and inside `layout` JSON (for rendering). The original design doc had `createdBy`/`userId`; we use `storeId` for scoping access and `createdById` for audit.

### Layout JSON Structure

```typescript
interface PriceLabelLayout {
  width: number          // mm
  height: number         // mm
  barcodeSource: "ean" | "sku"
  zones: {
    header: ZoneElement[]
    body: ZoneElement[]
    footer: ZoneElement[]
  }
}

interface ZoneElement {
  id: string             // nanoid, unique key for drag-and-drop
  type: "productName" | "price" | "oldPrice" | "sku"
      | "barcode" | "storeName" | "date" | "logo" | "text" | "qrCode"
  fontSize: number       // px (6-72)
  fontWeight: "normal" | "bold"
  textAlign: "left" | "center" | "right"
  value?: string         // for "text" and "qrCode" types only
}
```

### Zod Validation

```typescript
const zoneElementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["productName", "price", "oldPrice", "sku",
                 "barcode", "storeName", "date", "logo", "text", "qrCode"]),
  fontSize: z.number().min(6).max(72),
  fontWeight: z.enum(["normal", "bold"]),
  textAlign: z.enum(["left", "center", "right"]),
  value: z.string().optional(),
})

const layoutSchema = z.object({
  width: z.number().min(20).max(200),
  height: z.number().min(15).max(200),
  barcodeSource: z.enum(["ean", "sku"]),
  zones: z.object({
    header: z.array(zoneElementSchema),
    body: z.array(zoneElementSchema),
    footer: z.array(zoneElementSchema),
  }),
})
```

---

## Available Label Elements

| Element | Type | Source |
|---------|------|--------|
| `productName` | auto | `product.name` |
| `price` | auto | `formatMoney(storeProduct.sellPrice)` — from StoreProduct for current store |
| `oldPrice` | auto | Last `sellPrice` from PriceHistory (field="sellPrice", most recent entry). Rendered with strikethrough. Hidden if no price history exists |
| `sku` | auto | `product.sku` |
| `barcode` | auto | EAN-13 or Code128 SVG via JsBarcode, source per template setting |
| `storeName` | auto | Current store name |
| `date` | auto | Print date (formatted) |
| `logo` | static | Image URL stored in element `value`. In MVP: user pastes a public URL. No upload mechanism — logo hosted externally or as static asset in `/public` |
| `text` | static | Arbitrary text entered in template editor, stored in `value` |
| `qrCode` | config | QR code rendered via `qrcode.react`. URL stored in element `value`. Static per template (same QR on every label). Typical use: store website or social media link |

---

## Pages & Routing

### 1. Template List: `/settings/price-labels`

- Permission: `settings.templates`
- Table: name, size (WxH mm), created date, actions (edit, duplicate, delete)
- "Create template" button
- "Print" button per template → opens PrintLabelsDialog

### 2. Template Editor: `/settings/price-labels/[id]`

- Permission: `settings.templates`
- Three-column layout:
  - **Left panel**: Template settings (name, size presets 50x30/60x40/70x50/custom, barcode source ean/sku)
  - **Center**: Live preview of label with real zone rendering, updates in real-time
  - **Right panel**: Zone element lists (header/body/footer), add element dropdown, drag-and-drop reorder, per-element settings (fontSize, fontWeight, textAlign, value for text/qrCode)
- Save button persists to DB

### 3. Print Page: `/print/price-labels`

- URL param: `templateId` only
- Print data (product IDs + quantities) passed via `localStorage` key `printLabelsData`:
  ```typescript
  interface PrintLabelsData {
    items: Array<{ productId: string; quantity: number }>
  }
  ```
  `PrintLabelsDialog` writes to localStorage → opens print page in new tab → print page reads and clears the key.
  This avoids URL length limits when printing many products.
- Client component reads localStorage, fetches template + products via server actions
- Renders A4 grid of labels using CSS mm units
- Auto-calculates labels per row/column based on template size
- `window.print()` button
- CSS `@media print` hides controls, sets `size: A4`

---

## Print Trigger Points

### A. From Settings (`/settings/price-labels`)

Template row → "Print" button → `PrintLabelsDialog`:
1. Search/select products (with search input)
2. Set quantity per product
3. "Print" → saves print data to localStorage → opens `/print/price-labels?templateId=X` in new tab

### B. From Catalog (`/catalog`)

Single product: "Print label" button in product actions → `PrintLabelsDialog` with product pre-selected.

Mass print: checkbox selection in product table → "Print labels" bulk action → `PrintLabelsDialog` with selected products pre-filled.

Both require `catalog.view` permission. Dialog includes template selector dropdown.

### C. After Stock Receive

After confirming stock receive (`StockReceive` status → confirmed), show dialog: "Print labels for received items?" → Yes → `PrintLabelsDialog` with received products pre-filled.

---

## Server Actions (`src/actions/price-labels.ts`)

| Action | Permission | Description |
|--------|-----------|-------------|
| `getTemplates(storeId)` | `settings.templates` | List store templates |
| `getTemplate(id)` | `settings.templates` | Single template with storeId validation |
| `createTemplate(data)` | `settings.templates` | Create with Zod layout validation |
| `updateTemplate(id, data)` | `settings.templates` | Update with storeId check |
| `deleteTemplate(id)` | `settings.templates` | Delete with storeId check |
| `duplicateTemplate(id)` | `settings.templates` | Copy as "Копия — {name}" |
| `setDefaultTemplate(id)` | `settings.templates` | Unset other defaults in store, set this one |
| `getProductsForPrint(storeId, productIds)` | `catalog.view` | Fetch product data with store-scoped prices: joins Product + StoreProduct (for sellPrice) + latest PriceHistory (for oldPrice) |

All actions follow existing patterns: `requirePermission`/`checkPermission`, store-scoped data access, Zod validation at boundary.

---

## Components

### Shared
- `PriceLabelRenderer` — renders single label from layout + product data. Used in editor preview and print page.
- `PrintLabelsDialog` — product selection + quantity + template picker → opens print page

### Editor
- `LabelEditorPage` — three-column layout orchestrator
- `LabelSettingsPanel` — left panel (name, size, barcode source)
- `LabelPreview` — center panel with scaled PriceLabelRenderer
- `ZoneEditor` — right panel, one per zone, drag-and-drop element list
- `ElementSettings` — popover/inline settings for fontSize, fontWeight, textAlign

### List
- `TemplateTable` — list of templates with actions

---

## Label Rendering Details

### Preview (in editor)
- Scale: mm → px with factor ~3.78 (1mm ≈ 3.78px at 96dpi)
- Zones split vertical space: header ~20%, body ~60%, footer ~20% (flexible based on content)
- Elements render top-to-bottom within zone

### Print (on A4)
- CSS units in mm for exact sizing
- Grid layout: `repeat(auto-fill, {width}mm)` columns
- Gap: 2mm between labels
- Labels per A4: floor(210 / (width + 2)) columns × floor(297 / (height + 2)) rows
- Page break after each full A4 grid

### Barcode Rendering
- JsBarcode renders to inline SVG
- EAN-13 for product barcode field
- Code128 for SKU
- Template `barcodeSource` setting determines which to use
- Barcode element auto-sizes width to fit zone (100% of zone width minus padding), height fixed at 15mm (standard for retail labels)

---

## Size Presets

```typescript
const SIZE_PRESETS = [
  { label: "50 × 30 мм", width: 50, height: 30 },
  { label: "60 × 40 мм", width: 60, height: 40 },
  { label: "70 × 50 мм", width: 70, height: 50 },
] as const
```

Custom size: user inputs width (20-200mm) and height (15-200mm).

## Default Template Behavior

When a template is marked as default (`isDefault: true`), it is auto-selected in `PrintLabelsDialog` when no template is explicitly chosen. Only one template per store can be default. `setDefaultTemplate` action unsets `isDefault` on all other templates in the same store within a transaction.

## Permissions

- Template CRUD: `settings.templates` (existing permission)
- Print from catalog: `catalog.view` (existing permission)
- No new permissions needed

---

## Edge Cases

- Product without barcode/EAN → barcode element shows "No barcode" text
- Product without oldPrice → oldPrice element hidden
- Empty zone → zone takes no vertical space
- Template with no elements → empty label preview with placeholder text
- Very long product name → CSS text overflow with ellipsis, font-size auto-shrink not in MVP
- Print with 0 products selected → button disabled
