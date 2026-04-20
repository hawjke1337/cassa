"use client"

import React from "react"
import { formatMoney, formatDate } from "@/lib/format"
import { DOCUMENT_TYPE_CONFIGS } from "@/lib/document-variables"
import type {
  DocumentType,
  DocumentBlock,
  TextBlock,
  HeadingBlock,
  KeyValueBlock,
  TableBlock,
  SignaturesBlock,
  DividerBlock,
  ImageBlock,
  SpacerBlock,
  PanelBlock,
  ShowIfCondition,
} from "@/lib/validations/document-templates"

// ---- Helpers ----

export function resolveText(
  content: string,
  data: Record<string, unknown>,
  documentType: DocumentType
): string {
  const config = DOCUMENT_TYPE_CONFIGS[documentType]
  const variableMap = new Map(config.variables.map((v) => [v.key, v]))

  return content.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
    const value = data[varName]
    if (value === undefined || value === null) return match

    const varDef = variableMap.get(varName)
    if (varDef?.isMoney && typeof value === "number") {
      return formatMoney(value)
    }
    if (varDef?.isDate) {
      const d = new Date(value as string)
      if (!isNaN(d.getTime())) return formatDate(d)
      return String(value)
    }

    return String(value)
  })
}

export function evaluateShowIf(
  condition: ShowIfCondition | null | undefined,
  data: Record<string, unknown>
): boolean {
  if (!condition) return true

  const value = data[condition.field]

  switch (condition.op) {
    case "exists":
      return value !== null && value !== undefined && value !== ""
    case "gt":
      return Number(value) > Number(condition.value)
    case "eq":
      // eslint-disable-next-line eqeqeq
      // Intentional loose equality: template data values are strings (from form inputs),
      // but condition values may be numbers (from JSON schema). "2" == 2 should be true.
      return value == condition.value
    default:
      return true
  }
}

// ---- Block renderers ----

function renderTextBlock(
  block: TextBlock,
  data: Record<string, unknown>,
  documentType: DocumentType
): React.ReactNode {
  const resolved = resolveText(block.content, data, documentType)
  return (
    <p
      style={{
        fontSize: `${block.fontSize}px`,
        fontWeight: block.fontWeight,
        textAlign: block.textAlign,
        margin: 0,
      }}
    >
      {resolved}
    </p>
  )
}

function renderHeadingBlock(
  block: HeadingBlock,
  data: Record<string, unknown>,
  documentType: DocumentType
): React.ReactNode {
  const resolved = resolveText(block.content, data, documentType)
  return (
    <div
      style={{
        fontSize: `${block.fontSize}px`,
        fontWeight: block.fontWeight,
        textAlign: block.textAlign,
        margin: "8px 0",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {resolved}
    </div>
  )
}

function renderKeyValueBlock(
  block: KeyValueBlock,
  data: Record<string, unknown>,
  documentType: DocumentType
): React.ReactNode {
  const visibleItems = block.items.filter((item) =>
    evaluateShowIf(item.showIf, data)
  )

  if (block.layout === "inline") {
    return (
      <div style={{ fontSize: `${block.fontSize}px` }}>
        {visibleItems.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "2px",
            }}
          >
            <span>{resolveText(item.label, data, documentType)}</span>
            <span>{resolveText(item.value, data, documentType)}</span>
          </div>
        ))}
      </div>
    )
  }

  // stacked layout
  return (
    <div style={{ fontSize: `${block.fontSize}px` }}>
      {visibleItems.map((item, idx) => (
        <div key={idx} style={{ marginBottom: "2px" }}>
          {resolveText(item.label, data, documentType)}:{" "}
          {resolveText(item.value, data, documentType)}
        </div>
      ))}
    </div>
  )
}

function renderTableBlock(
  block: TableBlock,
  data: Record<string, unknown>,
  items: Record<string, unknown>[],
  documentType: DocumentType
): React.ReactNode {
  const config = DOCUMENT_TYPE_CONFIGS[documentType]
  const moneyColumns = new Set(
    config.tableColumns.filter((c) => c.isMoney).map((c) => c.key)
  )

  const totalColCount =
    block.columns.length + (block.showRowNumbers ? 1 : 0)

  // Compute total sum
  let totalSum = 0
  for (const item of items) {
    const itemTotal =
      item.total !== undefined && item.total !== null
        ? Number(item.total)
        : Number(item.price ?? item.costPrice ?? 0) *
          Number(item.quantity ?? 1)
    totalSum += itemTotal
  }

  return (
    <table
      className="print-table"
      style={{ fontSize: `${block.fontSize}px` }}
    >
      <thead style={{ display: "table-header-group" }}>
        <tr>
          {block.showRowNumbers && (
            <th style={{ width: "30px", textAlign: "center" }}>№</th>
          )}
          {block.columns.map((col) => (
            <th
              key={col.key}
              style={{
                width: col.width === "auto" ? undefined : col.width,
                textAlign: col.align,
              }}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td
              colSpan={totalColCount}
              style={{ textAlign: "center", padding: "8px" }}
            >
              Нет позиций
            </td>
          </tr>
        ) : (
          <>
            {items.map((item, idx) => (
              <tr key={idx} style={{ breakInside: "avoid" }}>
                {block.showRowNumbers && (
                  <td style={{ textAlign: "center" }}>{idx + 1}</td>
                )}
                {block.columns.map((col) => {
                  const raw = item[col.key]
                  let display: string
                  if (col.key === "total") {
                    const val =
                      raw !== undefined && raw !== null
                        ? Number(raw)
                        : Number(item.price ?? item.costPrice ?? 0) *
                          Number(item.quantity ?? 1)
                    display = moneyColumns.has(col.key)
                      ? formatMoney(val)
                      : String(val)
                  } else if (moneyColumns.has(col.key) && raw != null) {
                    display = formatMoney(Number(raw))
                  } else {
                    display = raw != null ? String(raw) : ""
                  }
                  return (
                    <td key={col.key} style={{ textAlign: col.align }}>
                      {display}
                    </td>
                  )
                })}
              </tr>
            ))}
            {block.showTotal && (
              <tr style={{ fontWeight: "bold", breakInside: "avoid" }}>
                <td
                  colSpan={
                    totalColCount - 1
                  }
                  style={{ textAlign: "right" }}
                >
                  {block.totalLabel}:
                </td>
                <td style={{ textAlign: "right" }}>
                  {formatMoney(totalSum)}
                </td>
              </tr>
            )}
          </>
        )}
      </tbody>
    </table>
  )
}

function renderSignaturesBlock(
  block: SignaturesBlock,
  data: Record<string, unknown>,
  documentType: DocumentType
): React.ReactNode {
  return (
    <div className="print-signatures">
      {block.items.map((item, idx) => (
        <div key={idx} className="print-signature-line">
          <span>{resolveText(item.label, data, documentType)}: </span>
          <span>_______________ </span>
          {item.name && (
            <span>{resolveText(item.name, data, documentType)}</span>
          )}
        </div>
      ))}
      {block.showDate && (
        <div className="print-signature-line">
          <span>Дата _____________</span>
        </div>
      )}
    </div>
  )
}

function renderDividerBlock(block: DividerBlock): React.ReactNode {
  return (
    <hr
      style={{
        borderStyle: block.style,
        margin: `${block.margin}px 0`,
        borderWidth: 0,
        borderTopWidth: "1px",
        borderColor: "#000",
      }}
    />
  )
}

function renderImageBlock(block: ImageBlock): React.ReactNode {
  return (
    <div style={{ textAlign: block.align }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.src}
        alt=""
        style={{ maxHeight: `${block.maxHeight}px` }}
      />
    </div>
  )
}

function renderSpacerBlock(block: SpacerBlock): React.ReactNode {
  return <div style={{ height: `${block.height}px` }} />
}

function renderPanelBlock(
  block: PanelBlock,
  data: Record<string, unknown>,
  items: Record<string, unknown>[],
  documentType: DocumentType
): React.ReactNode {
  const visibleChildren = block.children.filter((child) =>
    evaluateShowIf(child.showIf, data)
  )

  return (
    <div
      style={{
        border: block.border ? "2px solid #000" : undefined,
        padding: `${block.padding}px`,
        borderRadius: "4px",
      }}
    >
      {visibleChildren.map((child) => (
        <div key={child.id}>
          {renderBlock(child, data, items, documentType)}
        </div>
      ))}
    </div>
  )
}

// ---- Main dispatcher ----

export function renderBlock(
  block: DocumentBlock,
  data: Record<string, unknown>,
  items: Record<string, unknown>[],
  documentType: DocumentType
): React.ReactNode {
  switch (block.type) {
    case "text":
      return renderTextBlock(block, data, documentType)
    case "heading":
      return renderHeadingBlock(block, data, documentType)
    case "keyValue":
      return renderKeyValueBlock(block, data, documentType)
    case "table":
      return renderTableBlock(block, data, items, documentType)
    case "signatures":
      return renderSignaturesBlock(block, data, documentType)
    case "divider":
      return renderDividerBlock(block)
    case "image":
      return renderImageBlock(block)
    case "spacer":
      return renderSpacerBlock(block)
    case "panel":
      return renderPanelBlock(block, data, items, documentType)
    default:
      return null
  }
}
