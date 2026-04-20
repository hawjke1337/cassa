"use client"

import { renderBlock, evaluateShowIf } from "./block-renderers"
import type { DocumentLayout, DocumentType } from "@/lib/validations/document-templates"

interface DocumentRendererProps {
  layout: DocumentLayout
  data: Record<string, unknown>
  items?: Record<string, unknown>[]
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
