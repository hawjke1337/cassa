"use client"

import { Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CommissionRule, CommissionType } from "@/lib/validations/motivation"

type MotivationGroup = {
  id: string
  code: string
  name: string
}

interface CommissionRulesEditorProps {
  rules: CommissionRule[]
  defaultCommission: CommissionRule
  groups: MotivationGroup[]
  onChange: (rules: CommissionRule[], defaultCommission: CommissionRule) => void
  disabled?: boolean
}

const BASIS_LABELS: Record<CommissionRule["basis"], string> = {
  PROFIT: "Прибыль",
  RETAIL_PRICE: "Розница",
}

const TYPE_LABELS: Record<CommissionType, string> = {
  PERCENT: "Процент",
  FIXED: "Фикс. сумма",
}

export function CommissionRulesEditor({
  rules,
  defaultCommission,
  groups,
  onChange,
  disabled = false,
}: CommissionRulesEditorProps) {
  function addRule() {
    const newRule: CommissionRule = {
      groupId: undefined,
      type: "PERCENT",
      rate: 0.1,
      basis: "PROFIT",
    }
    onChange([...rules, newRule], defaultCommission)
  }

  function deleteRule(index: number) {
    const updated = rules.filter((_, i) => i !== index)
    onChange(updated, defaultCommission)
  }

  function updateRule(index: number, patch: Partial<CommissionRule>) {
    const updated = rules.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange(updated, defaultCommission)
  }

  function updateDefault(patch: Partial<CommissionRule>) {
    onChange(rules, { ...defaultCommission, ...patch })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Правила комиссии по группам</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRule}
          disabled={disabled}
        >
          <Plus className="size-4" />
          Добавить правило
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Группа</TableHead>
              <TableHead className="w-36">Тип</TableHead>
              <TableHead className="w-28">Ставка</TableHead>
              <TableHead className="w-40">База</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-16 text-center text-muted-foreground"
                >
                  Нет правил — применяется комиссия по умолчанию
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule, index) => {
                const isFixed = (rule.type ?? "PERCENT") === "FIXED"
                return (
                <TableRow key={index}>
                  <TableCell>
                    <Select
                      value={rule.groupId ?? "__none__"}
                      onValueChange={(val) =>
                        updateRule(index, {
                          groupId: val === "__none__" ? undefined : (val ?? undefined),
                        })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите группу" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Не указана —</SelectItem>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={rule.type ?? "PERCENT"}
                      onValueChange={(val) =>
                        updateRule(index, {
                          type: val as CommissionType,
                          rate: val === "FIXED" ? 0 : 0.1,
                        })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["PERCENT", "FIXED"] as const).map((t) => (
                          <SelectItem key={t} value={t}>
                            {TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {isFixed ? (
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={rule.rate}
                        onChange={(e) =>
                          updateRule(index, {
                            rate: parseFloat(e.target.value) || 0,
                          })
                        }
                        disabled={disabled}
                        className="w-24"
                        placeholder="₽"
                      />
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={+(rule.rate * 100).toFixed(4)}
                        onChange={(e) =>
                          updateRule(index, {
                            rate: parseFloat(e.target.value) / 100,
                          })
                        }
                        disabled={disabled}
                        className="w-24"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {isFixed ? (
                      <span className="text-sm text-muted-foreground px-3">—</span>
                    ) : (
                    <Select
                      value={rule.basis}
                      onValueChange={(val) =>
                        updateRule(index, {
                          basis: val as CommissionRule["basis"],
                        })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["PROFIT", "RETAIL_PRICE"] as const).map((b) => (
                          <SelectItem key={b} value={b}>
                            {BASIS_LABELS[b]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteRule(index)}
                      disabled={disabled}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                      <span className="sr-only">Удалить правило</span>
                    </Button>
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Default commission */}
      <div className="rounded-md border p-4 space-y-3 bg-muted/30">
        <p className="text-sm font-medium text-muted-foreground">
          Комиссия по умолчанию (применяется к товарам без группы)
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Тип:</span>
            <Select
              value={defaultCommission.type ?? "PERCENT"}
              onValueChange={(val) =>
                updateDefault({
                  type: val as CommissionType,
                  rate: val === "FIXED" ? 0 : 0.1,
                })
              }
              disabled={disabled}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["PERCENT", "FIXED"] as const).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {(defaultCommission.type ?? "PERCENT") === "FIXED" ? "Сумма, ₽:" : "Ставка, %:"}
            </span>
            {(defaultCommission.type ?? "PERCENT") === "FIXED" ? (
              <Input
                type="number"
                min={0}
                step={1}
                value={defaultCommission.rate}
                onChange={(e) =>
                  updateDefault({ rate: parseFloat(e.target.value) || 0 })
                }
                disabled={disabled}
                className="w-24"
              />
            ) : (
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={+(defaultCommission.rate * 100).toFixed(4)}
                onChange={(e) =>
                  updateDefault({ rate: parseFloat(e.target.value) / 100 })
                }
                disabled={disabled}
                className="w-24"
              />
            )}
          </div>
          {(defaultCommission.type ?? "PERCENT") !== "FIXED" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">База:</span>
              <Select
                value={defaultCommission.basis}
                onValueChange={(val) =>
                  updateDefault({ basis: val as CommissionRule["basis"] })
                }
                disabled={disabled}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["PROFIT", "RETAIL_PRICE"] as const).map((b) => (
                    <SelectItem key={b} value={b}>
                      {BASIS_LABELS[b]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
