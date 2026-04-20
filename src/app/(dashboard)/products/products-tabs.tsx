"use client"

/**
 * UX2-16: Client-side Tabs wrapper.
 *
 * Синхронизирует выбранный tab с URL (?tab=catalog|warehouse) через
 * router.replace (без page reload), чтобы закладки и F5 сохраняли
 * текущую вкладку. Reuses existing CatalogPageClient + StockOverviewClient
 * чтобы не дублировать таблицы и хуки.
 */

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CatalogPageClient } from "@/app/(dashboard)/catalog/catalog-page-client"
import { StockOverviewClient } from "@/app/(dashboard)/inventory/stock-overview-client"

interface ProductsTabsProps {
  initialTab: string
  canViewCatalog: boolean
  canViewInventory: boolean
  canSeePrices: boolean
}

export function ProductsTabs({
  initialTab,
  canViewCatalog,
  canViewInventory,
  canSeePrices,
}: ProductsTabsProps) {
  const router = useRouter()
  const sp = useSearchParams()
  const tab = sp.get("tab") ?? initialTab

  function handleChange(value: string) {
    const next = new URLSearchParams(sp.toString())
    next.set("tab", value)
    router.replace(`/products?${next.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={tab} onValueChange={handleChange}>
      <TabsList>
        {canViewCatalog && <TabsTrigger value="catalog">Каталог</TabsTrigger>}
        {canViewInventory && <TabsTrigger value="warehouse">Склад</TabsTrigger>}
      </TabsList>
      {canViewCatalog && (
        <TabsContent value="catalog" className="mt-4">
          <CatalogPageClient canSeePrices={canSeePrices} />
        </TabsContent>
      )}
      {canViewInventory && (
        <TabsContent value="warehouse" className="mt-4">
          <StockOverviewClient canSeePrices={canSeePrices} />
        </TabsContent>
      )}
    </Tabs>
  )
}
