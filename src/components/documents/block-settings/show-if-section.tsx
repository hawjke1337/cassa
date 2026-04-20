"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import type { ShowIfCondition } from "@/lib/validations/document-templates"

interface ShowIfSectionProps {
  value?: ShowIfCondition | null
  onChange: (condition: ShowIfCondition | null) => void
}

export function ShowIfSection({ value, onChange }: ShowIfSectionProps) {
  const [open, setOpen] = useState(false)

  const condition = value ?? null

  function handleFieldChange(field: string) {
    if (!field) {
      onChange(null)
      return
    }
    onChange({ field, op: condition?.op ?? "exists", value: condition?.value })
  }

  function handleOpChange(op: "exists" | "gt" | "eq") {
    if (!condition?.field) return
    onChange({ field: condition.field, op, value: op === "exists" ? undefined : condition.value })
  }

  function handleValueChange(val: string) {
    if (!condition?.field) return
    const num = Number(val)
    onChange({ field: condition.field, op: condition.op, value: isNaN(num) ? val : num })
  }

  return (
    <div className="mt-3">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 gap-1 text-muted-foreground text-xs"
        onClick={() => setOpen((p) => !p)}
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        Условие отображения
      </Button>
      {open && (
        <div className="mt-2 space-y-2 pl-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Поле</Label>
              <Input
                className="h-8 text-sm"
                placeholder="например: discount"
                value={condition?.field ?? ""}
                onChange={(e) => handleFieldChange(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Условие</Label>
              <Select
                value={condition?.op ?? "exists"}
                onValueChange={(v) => handleOpChange(v as "exists" | "gt" | "eq")}
                disabled={!condition?.field}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exists">Существует</SelectItem>
                  <SelectItem value="gt">Больше</SelectItem>
                  <SelectItem value="eq">Равно</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {condition?.op && condition.op !== "exists" && (
            <div>
              <Label className="text-xs">Значение</Label>
              <Input
                className="h-8 text-sm"
                placeholder="значение"
                value={String(condition.value ?? "")}
                onChange={(e) => handleValueChange(e.target.value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
