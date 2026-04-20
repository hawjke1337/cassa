"use client"

import type { MotivationFormula } from "@/lib/validations/motivation"
import {
  COMMISSION_BASIS_LABELS,
  COMMISSION_TYPE_LABELS,
} from "@/lib/validations/motivation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface FormulaDiffProps {
  oldFormula: MotivationFormula | null
  newFormula: MotivationFormula
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatRate(rate: number, type?: string) {
  if (type === "FIXED") return formatMoney(rate) + "/шт"
  return (rate * 100).toFixed(1) + "%"
}

function DiffCell({
  oldVal,
  newVal,
  format = (v) => String(v),
}: {
  oldVal?: string | number | null
  newVal: string | number
  format?: (v: string | number) => string
}) {
  const changed = oldVal != null && oldVal !== newVal
  return (
    <div className="flex gap-3">
      {oldVal != null && (
        <span className={changed ? "line-through text-muted-foreground" : ""}>
          {format(oldVal)}
        </span>
      )}
      {changed && (
        <span className="font-medium text-green-700 dark:text-green-400">
          {format(newVal)}
        </span>
      )}
      {!changed && oldVal == null && (
        <span>{format(newVal)}</span>
      )}
    </div>
  )
}

export function FormulaDiff({ oldFormula, newFormula }: FormulaDiffProps) {
  return (
    <div className="space-y-6">
      {/* Daily Rate */}
      <div className="rounded-md border p-4">
        <h4 className="text-sm font-medium mb-2">Ставка за смену</h4>
        <DiffCell
          oldVal={oldFormula?.dailyRate}
          newVal={newFormula.dailyRate}
          format={(v) => formatMoney(Number(v))}
        />
      </div>

      {/* Repair Bonus */}
      <div className="rounded-md border p-4">
        <h4 className="text-sm font-medium mb-2">Бонус за ремонт</h4>
        <DiffCell
          oldVal={oldFormula?.repairBonus}
          newVal={newFormula.repairBonus}
          format={(v) => formatMoney(Number(v))}
        />
      </div>

      {/* Default Commission */}
      <div className="rounded-md border p-4">
        <h4 className="text-sm font-medium mb-2">Комиссия по умолчанию</h4>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Тип: </span>
            <DiffCell
              oldVal={oldFormula?.defaultCommission.type ?? "PERCENT"}
              newVal={newFormula.defaultCommission.type ?? "PERCENT"}
              format={(v) => COMMISSION_TYPE_LABELS[v as "PERCENT" | "FIXED"]}
            />
          </div>
          <div>
            <span className="text-muted-foreground">Ставка: </span>
            <DiffCell
              oldVal={oldFormula?.defaultCommission.rate}
              newVal={newFormula.defaultCommission.rate}
              format={(v) => formatRate(Number(v), newFormula.defaultCommission.type)}
            />
          </div>
          {(newFormula.defaultCommission.type ?? "PERCENT") !== "FIXED" && (
            <div>
              <span className="text-muted-foreground">База: </span>
              <DiffCell
                oldVal={oldFormula?.defaultCommission.basis}
                newVal={newFormula.defaultCommission.basis}
                format={(v) => COMMISSION_BASIS_LABELS[v as "PROFIT" | "RETAIL_PRICE"]}
              />
            </div>
          )}
        </div>
      </div>

      {/* Commission Rules */}
      <div className="rounded-md border">
        <div className="p-4 pb-2">
          <h4 className="text-sm font-medium">Правила комиссий по группам</h4>
        </div>
        {newFormula.commissionRules.length === 0 && (!oldFormula || oldFormula.commissionRules.length === 0) ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Нет правил по группам</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Группа</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Ставка</TableHead>
                <TableHead>База</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newFormula.commissionRules.map((rule, i) => {
                const oldRule = oldFormula?.commissionRules.find(
                  (r) => r.groupId === rule.groupId,
                )
                return (
                  <TableRow key={rule.groupId ?? i}>
                    <TableCell className="text-sm">{rule.groupId ?? "—"}</TableCell>
                    <TableCell>
                      <DiffCell
                        oldVal={oldRule?.type ?? "PERCENT"}
                        newVal={rule.type ?? "PERCENT"}
                        format={(v) => COMMISSION_TYPE_LABELS[v as "PERCENT" | "FIXED"]}
                      />
                    </TableCell>
                    <TableCell>
                      <DiffCell
                        oldVal={oldRule?.rate}
                        newVal={rule.rate}
                        format={(v) => formatRate(Number(v), rule.type)}
                      />
                    </TableCell>
                    <TableCell>
                      {(rule.type ?? "PERCENT") === "FIXED" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <DiffCell
                          oldVal={oldRule?.basis}
                          newVal={rule.basis}
                          format={(v) => COMMISSION_BASIS_LABELS[v as "PROFIT" | "RETAIL_PRICE"]}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Cross-Sell Bonuses */}
      <div className="rounded-md border">
        <div className="p-4 pb-2">
          <h4 className="text-sm font-medium">Кросс-продажи</h4>
        </div>
        {newFormula.crossSellBonuses.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Нет бонусов за кросс-продажи</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Мин. позиций</TableHead>
                <TableHead>Бонус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newFormula.crossSellBonuses.map((bonus, i) => {
                const oldBonus = oldFormula?.crossSellBonuses.find(
                  (b) => b.minItems === bonus.minItems,
                )
                return (
                  <TableRow key={i}>
                    <TableCell>{bonus.minItems}</TableCell>
                    <TableCell>
                      <DiffCell
                        oldVal={oldBonus?.bonus}
                        newVal={bonus.bonus}
                        format={(v) => formatMoney(Number(v))}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
