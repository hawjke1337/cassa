"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { VariableBadges } from "./variable-badges"
import { ShowIfSection } from "./show-if-section"
import type { SignaturesBlock, SignatureItem, DocumentType } from "@/lib/validations/document-templates"

interface SignaturesSettingsProps {
  block: SignaturesBlock
  documentType: DocumentType
  onChange: (block: SignaturesBlock) => void
}

export function SignaturesSettings({ block, documentType, onChange }: SignaturesSettingsProps) {
  function update(patch: Partial<SignaturesBlock>) {
    onChange({ ...block, ...patch })
  }

  function updateItem(idx: number, patch: Partial<SignatureItem>) {
    update({ items: block.items.map((item, i) => i === idx ? { ...item, ...patch } : item) })
  }

  function addItem() {
    update({ items: [...block.items, { label: "Подпись", name: "" }] })
  }

  function removeItem(idx: number) {
    update({ items: block.items.filter((_, i) => i !== idx) })
  }

  function insertVariableToName(idx: number, variable: string) {
    const item = block.items[idx]
    if (!item) return
    updateItem(idx, { name: item.name + variable })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs">Подписи</Label>
        {block.items.map((item, idx) => (
          <div key={idx} className="border rounded-md p-2 space-y-2">
            <div className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <Input
                  className="h-8 text-sm"
                  placeholder="Метка (например: Продавец)"
                  value={item.label}
                  onChange={(e) => updateItem(idx, { label: e.target.value })}
                />
                <Input
                  className="h-8 text-sm"
                  placeholder="Имя или {{переменная}}"
                  value={item.name}
                  onChange={(e) => updateItem(idx, { name: e.target.value })}
                />
                <VariableBadges
                  documentType={documentType}
                  onInsert={(v) => insertVariableToName(idx, v)}
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
          Добавить подпись
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm">Показывать дату</Label>
        <Switch
          checked={block.showDate}
          onCheckedChange={(v) => update({ showDate: v })}
        />
      </div>

      <ShowIfSection
        value={block.showIf}
        onChange={(condition) => onChange({ ...block, showIf: condition })}
      />
    </div>
  )
}
