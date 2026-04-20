"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useCurrentStore } from "@/hooks/use-current-store"
import { getUserStores } from "@/actions/stores"
import { DateRangePicker } from "@/components/reports/date-range-picker"
import { SalesReport } from "@/components/reports/sales-report"
import { ProfitReport } from "@/components/reports/profit-report"
import { InventoryReport } from "@/components/reports/inventory-report"
import { SellerReport } from "@/components/reports/seller-report"
import { CashReport } from "@/components/reports/cash-report"

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartStr() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

interface ReportsPageClientProps {
  canViewProfit: boolean
  canViewInventory: boolean
}

export function ReportsPageClient({ canViewProfit, canViewInventory }: ReportsPageClientProps) {
  const { currentStoreId } = useCurrentStore()
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string>("")
  const [dateFrom, setDateFrom] = useState(monthStartStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [activeTab, setActiveTab] = useState("sales")
  const [groupBy, setGroupBy] = useState<"day" | "month">("day")

  useEffect(() => {
    getUserStores().then((s) => {
      setStores(s)
      if (currentStoreId) {
        setSelectedStoreId(currentStoreId)
      } else if (s.length > 0) {
        setSelectedStoreId(s[0].id)
      }
    })
  }, [currentStoreId])

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-start gap-4">
        <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={handleDateChange} />

        {stores.length > 1 && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Магазин</span>
            <Select value={selectedStoreId} onValueChange={(val) => setSelectedStoreId(val ?? "")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Все магазины" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все магазины</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {activeTab === "sales" && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Группировка</span>
            <div className="flex gap-1">
              <Button
                variant={groupBy === "day" ? "default" : "outline"}
                size="sm"
                onClick={() => setGroupBy("day")}
              >
                По дням
              </Button>
              <Button
                variant={groupBy === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setGroupBy("month")}
              >
                По месяцам
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Report tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as string)}>
        <TabsList>
          <TabsTrigger value="sales">Продажи</TabsTrigger>
          {canViewProfit && <TabsTrigger value="profit">Прибыль</TabsTrigger>}
          {canViewInventory && <TabsTrigger value="inventory">Склад</TabsTrigger>}
          <TabsTrigger value="sellers">Продавцы</TabsTrigger>
          <TabsTrigger value="cash">Кассовый отчёт</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          <SalesReport
            storeId={resolveStoreId(selectedStoreId)}
            dateFrom={dateFrom}
            dateTo={dateTo}
            groupBy={groupBy}
          />
        </TabsContent>

        {canViewProfit && (
          <TabsContent value="profit" className="mt-4">
            <ProfitReport
              storeId={resolveStoreId(selectedStoreId)}
              dateFrom={dateFrom}
              dateTo={dateTo}
            />
          </TabsContent>
        )}

        {canViewInventory && (
          <TabsContent value="inventory" className="mt-4">
            {selectedStoreId && selectedStoreId !== "all" ? (
              <InventoryReport storeId={selectedStoreId} />
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                Выберите конкретный магазин для отчёта по складу
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="sellers" className="mt-4">
          <SellerReport
            storeId={resolveStoreId(selectedStoreId)}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </TabsContent>

        <TabsContent value="cash" className="mt-4">
          {selectedStoreId && selectedStoreId !== "all" ? (
            <CashReport storeId={selectedStoreId} dateFrom={dateFrom} dateTo={dateTo} />
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              Выберите конкретный магазин для кассового отчёта
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function resolveStoreId(id: string): string | undefined {
  return id && id !== "all" ? id : undefined
}
