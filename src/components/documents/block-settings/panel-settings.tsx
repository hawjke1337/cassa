"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ShowIfSection } from "./show-if-section"
import { BlockList } from "@/components/documents/block-list"
import type { PanelBlock, DocumentBlock, DocumentType } from "@/lib/validations/document-templates"

interface PanelSettingsProps {
  block: PanelBlock
  documentType: DocumentType
  onChange: (block: PanelBlock) => void
}

export function PanelSettings({ block, documentType, onChange }: PanelSettingsProps) {
  function update(patch: Partial<PanelBlock>) {
    onChange({ ...block, ...patch })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Рамка</Label>
        <Switch
          checked={block.border}
          onCheckedChange={(v) => update({ border: v })}
        />
      </div>

      <div>
        <Label className="text-xs">Внутренний отступ (pt)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          className="h-8 text-sm mt-1"
          value={block.padding}
          onChange={(e) => update({ padding: Number(e.target.value) })}
        />
      </div>

      <div>
        <Label className="text-xs mb-2 block">Содержимое панели</Label>
        <div className="pl-2 border-l-2">
          <BlockList
            blocks={block.children as DocumentBlock[]}
            documentType={documentType}
            onChange={(children) => update({ children: children as PanelBlock["children"] })}
            excludeTypes={["panel"]}
          />
        </div>
      </div>

      <ShowIfSection
        value={block.showIf}
        onChange={(condition) => onChange({ ...block, showIf: condition })}
      />
    </div>
  )
}
