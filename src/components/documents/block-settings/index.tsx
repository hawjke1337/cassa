"use client"

import type { DocumentBlock, DocumentType } from "@/lib/validations/document-templates"
import { TextHeadingSettings } from "./text-heading-settings"
import { KeyValueSettings } from "./key-value-settings"
import { TableSettings } from "./table-settings"
import { SignaturesSettings } from "./signatures-settings"
import { PanelSettings } from "./panel-settings"
import { SimpleSettings } from "./simple-settings"

export interface BlockSettingsProps {
  block: DocumentBlock
  documentType: DocumentType
  onChange: (block: DocumentBlock) => void
}

export function BlockSettings({ block, documentType, onChange }: BlockSettingsProps) {
  switch (block.type) {
    case "text":
    case "heading":
      return (
        <TextHeadingSettings
          block={block}
          documentType={documentType}
          onChange={onChange}
        />
      )
    case "keyValue":
      return (
        <KeyValueSettings
          block={block}
          documentType={documentType}
          onChange={onChange}
        />
      )
    case "table":
      return (
        <TableSettings
          block={block}
          documentType={documentType}
          onChange={onChange}
        />
      )
    case "signatures":
      return (
        <SignaturesSettings
          block={block}
          documentType={documentType}
          onChange={onChange}
        />
      )
    case "panel":
      return (
        <PanelSettings
          block={block}
          documentType={documentType}
          onChange={onChange}
        />
      )
    case "divider":
    case "spacer":
    case "image":
      return (
        <SimpleSettings
          block={block}
          documentType={documentType}
          onChange={onChange}
        />
      )
    default:
      return null
  }
}
