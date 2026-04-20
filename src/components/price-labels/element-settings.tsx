"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import type { ZoneElement } from "@/lib/validations/price-labels"
import { ELEMENT_TYPE_LABELS } from "@/components/price-labels/label-constants"

interface ElementSettingsProps {
  element: ZoneElement
  onChange: (element: ZoneElement) => void
  onDelete: () => void
}

export function ElementSettings({ element, onChange, onDelete }: ElementSettingsProps) {
  const needsValue = element.type === "text" || element.type === "qrCode" || element.type === "logo"

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{ELEMENT_TYPE_LABELS[element.type]}</span>
        <Button variant="ghost" size="icon" className="size-7" onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Размер</Label>
          <Input
            type="number"
            min={6}
            max={72}
            value={element.fontSize}
            onChange={(e) =>
              onChange({ ...element, fontSize: Number(e.target.value) || 10 })
            }
            className="h-8"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Жирный</Label>
          <Select
            value={element.fontWeight}
            onValueChange={(v) =>
              onChange({ ...element, fontWeight: v as "normal" | "bold" })
            }
          >
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Обычный</SelectItem>
              <SelectItem value="bold">Жирный</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Выравн.</Label>
          <Select
            value={element.textAlign}
            onValueChange={(v) =>
              onChange({ ...element, textAlign: v as "left" | "center" | "right" })
            }
          >
            <SelectTrigger className="h-8 w-24">
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

      {needsValue && (
        <div className="space-y-1">
          <Label className="text-xs">
            {element.type === "text" ? "Текст" : element.type === "qrCode" ? "URL" : "URL изображения"}
          </Label>
          <Input
            value={element.value ?? ""}
            onChange={(e) => onChange({ ...element, value: e.target.value })}
            placeholder={element.type === "logo" ? "https://..." : undefined}
            className="h-8"
          />
        </div>
      )}
    </div>
  )
}
