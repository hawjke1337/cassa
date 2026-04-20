"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ShowIfSection } from "./show-if-section"
import { DOCUMENT_TYPE_CONFIGS } from "@/lib/document-variables"
import type { TableBlock, TableColumn, DocumentType } from "@/lib/validations/document-templates"

interface TableSettingsProps {
  block: TableBlock
  documentType: DocumentType
  onChange: (block: TableBlock) => void
}

export function TableSettings({ block, documentType, onChange }: TableSettingsProps) {
  const availableColumns = DOCUMENT_TYPE_CONFIGS[documentType].tableColumns

  function update(patch: Partial<TableBlock>) {
    onChange({ ...block, ...patch })
  }

  function isColumnChecked(key: string) {
    return block.columns.some((c) => c.key === key)
  }

  function toggleColumn(key: string, checked: boolean) {
    if (checked) {
      const def = availableColumns.find((c) => c.key === key)
      if (!def) return
      const newCol: TableColumn = {
        key: def.key,
        header: def.label,
        width: def.defaultWidth,
        align: def.defaultAlign,
      }
      update({ columns: [...block.columns, newCol] })
    } else {
      update({ columns: block.columns.filter((c) => c.key !== key) })
    }
  }

  function updateColumn(key: string, patch: Partial<TableColumn>) {
    update({
      columns: block.columns.map((c) => c.key === key ? { ...c, ...patch } : c),
    })
  }

  return (
    <div className="space-y-3">
      {availableColumns.length > 0 ? (
        <div>
          <Label className="text-xs">Колонки</Label>
          <div className="mt-2 space-y-2">
            {availableColumns.map((def) => {
              const col = block.columns.find((c) => c.key === def.key)
              const checked = !!col
              return (
                <div key={def.key} className="border rounded-md p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`col-${def.key}`}
                      checked={checked}
                      onCheckedChange={(v) => toggleColumn(def.key, !!v)}
                    />
                    <label htmlFor={`col-${def.key}`} className="text-sm font-medium cursor-pointer">
                      {def.label}
                    </label>
                  </div>
                  {checked && col && (
                    <div className="grid grid-cols-3 gap-2 pl-6">
                      <div>
                        <Label className="text-xs">Заголовок</Label>
                        <Input
                          className="h-7 text-xs mt-0.5"
                          value={col.header}
                          onChange={(e) => updateColumn(def.key, { header: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Ширина</Label>
                        <Input
                          className="h-7 text-xs mt-0.5"
                          placeholder="auto"
                          value={col.width}
                          onChange={(e) => updateColumn(def.key, { width: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Выравн.</Label>
                        <Select
                          value={col.align}
                          onValueChange={(v) => updateColumn(def.key, { align: v as "left" | "center" | "right" })}
                        >
                          <SelectTrigger className="h-7 text-xs mt-0.5">
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
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Колонки недоступны для этого типа документа.</p>
      )}

      <div className="flex items-center justify-between">
        <Label className="text-sm">Нумерация строк</Label>
        <Switch
          checked={block.showRowNumbers}
          onCheckedChange={(v) => update({ showRowNumbers: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm">Строка итого</Label>
        <Switch
          checked={block.showTotal}
          onCheckedChange={(v) => update({ showTotal: v })}
        />
      </div>

      {block.showTotal && (
        <div>
          <Label className="text-xs">Метка итого</Label>
          <Input
            className="h-8 text-sm mt-1"
            value={block.totalLabel}
            onChange={(e) => update({ totalLabel: e.target.value })}
          />
        </div>
      )}

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

      <ShowIfSection
        value={block.showIf}
        onChange={(condition) => onChange({ ...block, showIf: condition })}
      />
    </div>
  )
}
