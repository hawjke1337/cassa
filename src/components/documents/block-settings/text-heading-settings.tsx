"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react"
import { VariableBadges } from "./variable-badges"
import { ShowIfSection } from "./show-if-section"
import type { TextBlock, HeadingBlock, DocumentType } from "@/lib/validations/document-templates"

type TextOrHeading = TextBlock | HeadingBlock

interface TextHeadingSettingsProps {
  block: TextOrHeading
  documentType: DocumentType
  onChange: (block: TextOrHeading) => void
}

export function TextHeadingSettings({ block, documentType, onChange }: TextHeadingSettingsProps) {
  function update(patch: Partial<TextOrHeading>) {
    onChange({ ...block, ...patch } as TextOrHeading)
  }

  function insertVariable(variable: string) {
    update({ content: block.content + variable } as Partial<TextOrHeading>)
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Содержимое</Label>
        <Textarea
          className="text-sm mt-1 min-h-[80px]"
          value={block.content}
          onChange={(e) => update({ content: e.target.value } as Partial<TextOrHeading>)}
          placeholder="Введите текст или используйте переменные"
        />
        <VariableBadges documentType={documentType} onInsert={insertVariable} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Размер шрифта</Label>
          <Input
            type="number"
            min={6}
            max={72}
            className="h-8 text-sm mt-1"
            value={block.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) } as Partial<TextOrHeading>)}
          />
        </div>
        <div>
          <Label className="text-xs">Начертание</Label>
          <Select
            value={block.fontWeight}
            onValueChange={(v) => update({ fontWeight: v as "normal" | "bold" } as Partial<TextOrHeading>)}
          >
            <SelectTrigger className="h-8 text-sm mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Обычное</SelectItem>
              <SelectItem value="bold">Жирное</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Выравнивание</Label>
        <div className="flex gap-1 mt-1">
          {(["left", "center", "right"] as const).map((align) => (
            <Button
              key={align}
              size="icon"
              variant={block.textAlign === align ? "default" : "outline"}
              className="size-8"
              onClick={() => update({ textAlign: align } as Partial<TextOrHeading>)}
            >
              {align === "left" && <AlignLeft className="size-4" />}
              {align === "center" && <AlignCenter className="size-4" />}
              {align === "right" && <AlignRight className="size-4" />}
            </Button>
          ))}
        </div>
      </div>

      <ShowIfSection
        value={block.showIf}
        onChange={(condition) => onChange({ ...block, showIf: condition })}
      />
    </div>
  )
}
