"use client"

import { Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CrossSellBonus } from "@/lib/validations/motivation"

interface CrossSellEditorProps {
  bonuses: CrossSellBonus[]
  onChange: (bonuses: CrossSellBonus[]) => void
  disabled?: boolean
}

export function CrossSellEditor({
  bonuses,
  onChange,
  disabled = false,
}: CrossSellEditorProps) {
  const sorted = [...bonuses].sort((a, b) => a.minItems - b.minItems)

  function addTier() {
    const maxItems = bonuses.length > 0 ? Math.max(...bonuses.map((b) => b.minItems)) : 1
    onChange([...bonuses, { minItems: maxItems + 1, bonus: 100 }])
  }

  function deleteTier(index: number) {
    // Find the actual item in the sorted list and remove from original
    const item = sorted[index]
    onChange(bonuses.filter((b) => b !== item))
  }

  function updateTier(index: number, patch: Partial<CrossSellBonus>) {
    const item = sorted[index]
    onChange(
      bonuses.map((b) => (b === item ? { ...b, ...patch } : b))
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Бонусы за кросс-продажи</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTier}
          disabled={disabled}
        >
          <Plus className="size-4" />
          Добавить порог
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Мин. позиций в чеке</TableHead>
              <TableHead className="w-40">Бонус, ₽</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-16 text-center text-muted-foreground"
                >
                  Нет порогов кросс-продаж
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((tier, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      type="number"
                      min={2}
                      step={1}
                      value={tier.minItems}
                      onChange={(e) =>
                        updateTier(index, {
                          minItems: parseInt(e.target.value, 10),
                        })
                      }
                      disabled={disabled}
                      className="w-28"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step={50}
                      value={tier.bonus}
                      onChange={(e) =>
                        updateTier(index, {
                          bonus: parseFloat(e.target.value),
                        })
                      }
                      disabled={disabled}
                      className="w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteTier(index)}
                      disabled={disabled}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                      <span className="sr-only">Удалить порог</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
