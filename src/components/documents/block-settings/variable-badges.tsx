"use client"

import { Badge } from "@/components/ui/badge"
import { DOCUMENT_TYPE_CONFIGS } from "@/lib/document-variables"
import type { DocumentType } from "@/lib/validations/document-templates"

interface VariableBadgesProps {
  documentType: DocumentType
  onInsert: (variable: string) => void
}

export function VariableBadges({ documentType, onInsert }: VariableBadgesProps) {
  const variables = DOCUMENT_TYPE_CONFIGS[documentType].variables
  if (!variables.length) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {variables.map((v) => (
        <Badge
          key={v.key}
          variant="outline"
          className="cursor-pointer text-xs hover:bg-accent select-none"
          onClick={() => onInsert(`{{${v.key}}}`)}
          title={v.label}
        >
          {`{{${v.key}}}`}
        </Badge>
      ))}
    </div>
  )
}
