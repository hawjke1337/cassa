"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ShowIfSection } from "./show-if-section"
import type { DividerBlock, SpacerBlock, ImageBlock, DocumentType } from "@/lib/validations/document-templates"

type SimpleBlock = DividerBlock | SpacerBlock | ImageBlock

interface SimpleSettingsProps {
  block: SimpleBlock
  documentType: DocumentType
  onChange: (block: SimpleBlock) => void
}

export function SimpleSettings({ block, documentType, onChange }: SimpleSettingsProps) {
  if (block.type === "divider") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Стиль линии</Label>
            <Select
              value={block.style}
              onValueChange={(v) => onChange({ ...block, style: v as "solid" | "dashed" })}
            >
              <SelectTrigger className="h-8 text-sm mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Сплошная</SelectItem>
                <SelectItem value="dashed">Пунктирная</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Отступ (pt)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              className="h-8 text-sm mt-1"
              value={block.margin}
              onChange={(e) => onChange({ ...block, margin: Number(e.target.value) })}
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

  if (block.type === "spacer") {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Высота (pt)</Label>
          <Input
            type="number"
            min={1}
            max={200}
            className="h-8 text-sm mt-1"
            value={block.height}
            onChange={(e) => onChange({ ...block, height: Number(e.target.value) })}
          />
        </div>
        <ShowIfSection
          value={block.showIf}
          onChange={(condition) => onChange({ ...block, showIf: condition })}
        />
      </div>
    )
  }

  if (block.type === "image") {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">URL изображения</Label>
          <Input
            className="h-8 text-sm mt-1"
            placeholder="https://..."
            value={block.src}
            onChange={(e) => onChange({ ...block, src: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Макс. высота (pt)</Label>
            <Input
              type="number"
              min={10}
              max={500}
              className="h-8 text-sm mt-1"
              value={block.maxHeight}
              onChange={(e) => onChange({ ...block, maxHeight: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">Выравнивание</Label>
            <Select
              value={block.align}
              onValueChange={(v) => onChange({ ...block, align: v as "left" | "center" | "right" })}
            >
              <SelectTrigger className="h-8 text-sm mt-1">
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
        <ShowIfSection
          value={block.showIf}
          onChange={(condition) => onChange({ ...block, showIf: condition })}
        />
      </div>
    )
  }

  return null
}
