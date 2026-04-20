"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import { VariableBadges } from "./variable-badges"
import { ShowIfSection } from "./show-if-section"
import type { KeyValueBlock, KeyValueItem, DocumentType } from "@/lib/validations/document-templates"

interface KeyValueSettingsProps {
  block: KeyValueBlock
  documentType: DocumentType
  onChange: (block: KeyValueBlock) => void
}

export function KeyValueSettings({ block, documentType, onChange }: KeyValueSettingsProps) {
  function update(patch: Partial<KeyValueBlock>) {
    onChange({ ...block, ...patch })
  }

  function updateItem(idx: number, patch: Partial<KeyValueItem>) {
    const items = block.items.map((item, i) => i === idx ? { ...item, ...patch } : item)
    update({ items })
  }

  function addItem() {
    update({ items: [...block.items, { label: "", value: "" }] })
  }

  function removeItem(idx: number) {
    update({ items: block.items.filter((_, i) => i !== idx) })
  }

  function insertVariableToItem(idx: number, variable: string) {
    const item = block.items[idx]
    if (!item) return
    updateItem(idx, { value: item.value + variable })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs">Поля</Label>
        {block.items.map((item, idx) => (
          <div key={idx} className="border rounded-md p-2 space-y-2">
            <div className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <Input
                  className="h-8 text-sm"
                  placeholder="Метка"
                  value={item.label}
                  onChange={(e) => updateItem(idx, { label: e.target.value })}
                />
                <Input
                  className="h-8 text-sm"
                  placeholder="Значение или {{переменная}}"
                  value={item.value}
                  onChange={(e) => updateItem(idx, { value: e.target.value })}
                />
                <VariableBadges
                  documentType={documentType}
                  onInsert={(v) => insertVariableToItem(idx, v)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive shrink-0"
                onClick={() => removeItem(idx)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={addItem}>
          <Plus className="size-4" />
          Добавить поле
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Расположение</Label>
          <Select
            value={block.layout}
            onValueChange={(v) => update({ layout: v as "stacked" | "inline" })}
          >
            <SelectTrigger className="h-8 text-sm mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stacked">Стопкой</SelectItem>
              <SelectItem value="inline">В линию</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Размер шрифта</Label>
          <Input
            type="number"
            min={6}
            max={72}
            className="h-8 text-sm mt-1"
            value={block.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
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
