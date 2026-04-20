"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DateRangePickerProps {
  dateFrom: string
  dateTo: string
  onChange: (dateFrom: string, dateTo: string) => void
}

function getPresets() {
  const now = new Date()
  const today = fmt(now)

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = fmt(yesterday)

  // This week (Monday start)
  const dayOfWeek = now.getDay() || 7
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek + 1)

  // This month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Last month
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

  return [
    { label: "Сегодня", from: today, to: today },
    { label: "Вчера", from: yesterdayStr, to: yesterdayStr },
    { label: "Эта неделя", from: fmt(weekStart), to: today },
    { label: "Этот месяц", from: fmt(monthStart), to: today },
    { label: "Прошлый месяц", from: fmt(lastMonthStart), to: fmt(lastMonthEnd) },
  ]
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function DateRangePicker({ dateFrom, dateTo, onChange }: DateRangePickerProps) {
  const presets = getPresets()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">С</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onChange(e.target.value, dateTo)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">По</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onChange(dateFrom, e.target.value)}
            className="w-40"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Button
            key={p.label}
            variant={dateFrom === p.from && dateTo === p.to ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange(p.from, p.to)}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
