"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getSalesByShift, searchSaleByNumber } from "@/actions/sales"
import { formatMoney, formatDate } from "@/lib/format"
import { toast } from "sonner"
import { Search, Receipt } from "lucide-react"

type ShiftSale = Awaited<ReturnType<typeof getSalesByShift>>[number]

interface SalesHistoryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shiftId: string | null
}

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Завершена",
  RETURNED: "Возвращена",
  PARTIALLY_RETURNED: "Частичный возврат",
}

export function SalesHistory({ open, onOpenChange, shiftId }: SalesHistoryProps) {
  const [sales, setSales] = useState<ShiftSale[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (open && shiftId) {
      setLoading(true)
      getSalesByShift(shiftId)
        .then(setSales)
        .catch(() => toast.error("Ошибка загрузки истории продаж"))
        .finally(() => setLoading(false))
    }
    if (!open) {
      setSales([])
      setSearchQuery("")
    }
  }, [open, shiftId])

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const result = await searchSaleByNumber(searchQuery.trim())
      if (result) {
        window.open(`/print/sale/${result.id}`, "_blank")
      } else {
        toast.error("Продажа не найдена")
      }
    } catch {
      toast.error("Ошибка поиска")
    } finally {
      setSearching(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="size-5" />
            История продаж
          </SheetTitle>
          <SheetDescription>Продажи текущей смены (последние 20)</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Search by number */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по номеру продажи..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
                disabled={searching}
              />
            </div>
          </div>

          {/* Sales list */}
          <ScrollArea className="h-[calc(100vh-200px)]">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : !shiftId ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Нет открытой смены
              </div>
            ) : sales.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Продаж в текущей смене пока нет
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {sales.map((sale) => (
                  <button
                    key={sale.id}
                    onClick={() => window.open(`/print/sale/${sale.id}`, "_blank")}
                    className="flex w-full flex-col rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">#{sale.number}</span>
                      <Badge
                        variant={
                          sale.status === "COMPLETED"
                            ? "secondary"
                            : sale.status === "RETURNED"
                              ? "destructive"
                              : "outline"
                        }
                        className="text-[10px]"
                      >
                        {STATUS_LABELS[sale.status] || sale.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(sale.createdAt)}</span>
                      <span>{sale.itemCount} товар(ов)</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{sale.sellerName}</span>
                      <span className="text-sm font-semibold">{formatMoney(sale.finalAmount)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
