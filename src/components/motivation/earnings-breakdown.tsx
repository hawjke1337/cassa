"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

// We mirror the EarningsResult shape from motivation-calculation.ts
interface SaleCommissionItem {
  productName: string
  groupCode: string | null
  sellPrice: number
  costPrice: number
  type: "PERCENT" | "FIXED"
  rate: number
  basis: "PROFIT" | "RETAIL_PRICE"
  commission: number
}

interface SaleCommission {
  saleId: string
  saleNumber: string
  date: string
  shiftId: string | null
  shiftDate: string | null
  shiftNumber: string | null
  items: SaleCommissionItem[]
  totalCommission: number
}

interface CrossSellBonusResult {
  saleId: string
  saleNumber: string
  itemCount: number
  bonus: number
}

interface RepairBonusResult {
  repairId: string
  repairNumber: string
  date: string
  bonus: number
}

interface ReturnDeduction {
  returnId: string
  saleNumber: string
  productName: string
  commission: number
}

export interface EarningsResultForBreakdown {
  dailyRate: {
    shiftsCount: number
    ratePerShift: number
    total: number
  }
  commissions: SaleCommission[]
  crossSellBonuses: CrossSellBonusResult[]
  repairBonuses: RepairBonusResult[]
  returnDeductions: ReturnDeduction[]
  totals: {
    daily: number
    commissions: number
    crossBonuses: number
    repairBonuses: number
    returns: number
    total: number
  }
}

interface EarningsBreakdownProps {
  earnings: EarningsResultForBreakdown
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU")
}

function SectionHeader({
  title,
  total,
  expanded,
  onToggle,
}: {
  title: string
  total: number
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        )}
        <span className="font-medium text-sm">{title}</span>
      </div>
      <span className={`text-sm font-semibold ${total < 0 ? "text-red-600" : ""}`}>
        {formatMoney(total)}
      </span>
    </button>
  )
}

interface ShiftGroup {
  shiftId: string | null
  shiftDate: string | null
  shiftNumber: string | null
  sales: SaleCommission[]
  totalCommission: number
  salesCount: number
}

function groupByShift(commissions: SaleCommission[]): ShiftGroup[] {
  const map = new Map<string, ShiftGroup>()
  for (const c of commissions) {
    const key = c.shiftId ?? "__no_shift__"
    const existing = map.get(key)
    if (existing) {
      existing.sales.push(c)
      existing.totalCommission += c.totalCommission
      existing.salesCount++
    } else {
      map.set(key, {
        shiftId: c.shiftId,
        shiftDate: c.shiftDate,
        shiftNumber: c.shiftNumber,
        sales: [c],
        totalCommission: c.totalCommission,
        salesCount: 1,
      })
    }
  }
  // Sort: shifts with dates first (newest first), then "no shift" last
  return Array.from(map.values()).sort((a, b) => {
    if (!a.shiftDate && b.shiftDate) return 1
    if (a.shiftDate && !b.shiftDate) return -1
    if (a.shiftDate && b.shiftDate) return b.shiftDate.localeCompare(a.shiftDate)
    return 0
  })
}

export function EarningsBreakdown({ earnings }: EarningsBreakdownProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [expandedShifts, setExpandedShifts] = useState<Set<string>>(new Set())
  const [expandedSales, setExpandedSales] = useState<Record<string, boolean>>({})

  function toggleSection(key: string) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleShift(key: string) {
    setExpandedShifts((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleSale(key: string) {
    setExpandedSales((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const shiftGroups = groupByShift(earnings.commissions)

  return (
    <div className="space-y-2">
      {/* Daily rate */}
      <div className="rounded-lg border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Ставка</span>
          <span className="text-sm font-semibold">{formatMoney(earnings.dailyRate.total)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {earnings.dailyRate.shiftsCount} смен × {formatMoney(earnings.dailyRate.ratePerShift)} ={" "}
          {formatMoney(earnings.dailyRate.total)}
        </p>
      </div>

      {/* Commissions — grouped by shift */}
      {earnings.commissions.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <SectionHeader
            title="Комиссии с продаж"
            total={earnings.totals.commissions}
            expanded={!!expandedSections.commissions}
            onToggle={() => toggleSection("commissions")}
          />
          {expandedSections.commissions && (
            <div className="border-t space-y-1 p-2">
              {shiftGroups.map((group) => {
                const shiftKey = group.shiftId ?? "__no_shift__"
                const isShiftExpanded = expandedShifts.has(shiftKey)
                const shiftLabel = group.shiftId
                  ? `Смена №${group.shiftNumber} — ${new Date(group.shiftDate!).toLocaleDateString("ru-RU")}`
                  : "Вне смен"

                return (
                  <div key={shiftKey}>
                    {/* Shift header */}
                    <button
                      type="button"
                      onClick={() => toggleShift(shiftKey)}
                      className="flex w-full items-center justify-between bg-muted/50 rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isShiftExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-medium">{shiftLabel}</span>
                        <span className="text-xs text-muted-foreground">
                          {group.salesCount}{" "}
                          {group.salesCount === 1
                            ? "продажа"
                            : group.salesCount < 5
                              ? "продажи"
                              : "продаж"}
                        </span>
                      </div>
                      <span className="text-sm font-semibold">
                        {formatMoney(group.totalCommission)}
                      </span>
                    </button>

                    {/* Sales inside shift */}
                    {isShiftExpanded && (
                      <div className="ml-4 border-l divide-y">
                        {group.sales.map((sale) => (
                          <div key={sale.saleId}>
                            <button
                              type="button"
                              onClick={() => toggleSale(sale.saleId)}
                              className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {expandedSales[sale.saleId] ? (
                                  <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                                )}
                                <span className="text-sm">Продажа №{sale.saleNumber}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(sale.date)}
                                </span>
                              </div>
                              <span className="text-sm font-medium">
                                {formatMoney(sale.totalCommission)}
                              </span>
                            </button>

                            {expandedSales[sale.saleId] && (
                              <div className="px-8 pb-2 space-y-1">
                                {sale.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start justify-between text-xs text-muted-foreground py-0.5"
                                  >
                                    <div className="flex-1 min-w-0 pr-4">
                                      <span className="text-foreground font-medium">
                                        {item.productName}
                                      </span>
                                      {item.groupCode && (
                                        <span className="ml-1.5 text-xs bg-muted rounded px-1">
                                          {item.groupCode}
                                        </span>
                                      )}
                                      <br />
                                      <span>
                                        {item.type === "FIXED" ? (
                                          <>{formatMoney(item.rate)}/шт</>
                                        ) : (
                                          <>
                                            {formatMoney(item.sellPrice)} ×{" "}
                                            {(item.rate * 100).toFixed(1)}%{" "}
                                            {item.basis === "PROFIT" ? "от прибыли" : "от цены"}
                                          </>
                                        )}
                                      </span>
                                    </div>
                                    <span className="text-foreground font-medium shrink-0">
                                      {formatMoney(item.commission)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Cross-sell bonuses */}
      {earnings.crossSellBonuses.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <SectionHeader
            title="Кросс-продажи"
            total={earnings.totals.crossBonuses}
            expanded={!!expandedSections.cross}
            onToggle={() => toggleSection("cross")}
          />
          {expandedSections.cross && (
            <div className="border-t divide-y">
              {earnings.crossSellBonuses.map((cb) => (
                <div
                  key={cb.saleId}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span>
                    Продажа №{cb.saleNumber} — {cb.itemCount} позиций
                  </span>
                  <span className="font-medium">{formatMoney(cb.bonus)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Repair bonuses */}
      {earnings.repairBonuses.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <SectionHeader
            title="Ремонты"
            total={earnings.totals.repairBonuses}
            expanded={!!expandedSections.repairs}
            onToggle={() => toggleSection("repairs")}
          />
          {expandedSections.repairs && (
            <div className="border-t divide-y">
              {earnings.repairBonuses.map((rb) => (
                <div
                  key={rb.repairId}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span>
                    Ремонт №{rb.repairNumber}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDate(rb.date)}
                    </span>
                  </span>
                  <span className="font-medium">{formatMoney(rb.bonus)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Return deductions */}
      {earnings.returnDeductions.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <SectionHeader
            title="Возвраты (удержания)"
            total={earnings.totals.returns}
            expanded={!!expandedSections.returns}
            onToggle={() => toggleSection("returns")}
          />
          {expandedSections.returns && (
            <div className="border-t divide-y">
              {earnings.returnDeductions.map((rd) => (
                <div
                  key={`${rd.returnId}-${rd.productName}`}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span>
                    {rd.productName}
                    <span className="ml-2 text-xs text-muted-foreground">
                      по чеку №{rd.saleNumber}
                    </span>
                  </span>
                  <span className="font-medium text-red-600">{formatMoney(rd.commission)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Total */}
      <div className="rounded-lg border px-4 py-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Итого к начислению</span>
          <span className="text-lg font-bold">{formatMoney(earnings.totals.total)}</span>
        </div>
      </div>
    </div>
  )
}
