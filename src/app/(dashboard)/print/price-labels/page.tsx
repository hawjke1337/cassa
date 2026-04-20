"use client"

import { useEffect, useState, useTransition, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { PrintLayout } from "@/components/print/print-layout"
import { PriceLabelRenderer } from "@/components/price-labels/label-renderer"
import { getTemplate, getProductsForPrint } from "@/actions/price-labels"
import type { PriceLabelLayout, PrintProductData, PrintLabelsData } from "@/lib/validations/price-labels"

export default function PrintLabelsPage() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get("templateId")

  const [isPending, startTransition] = useTransition()
  const [layout, setLayout] = useState<PriceLabelLayout | null>(null)
  const [products, setProducts] = useState<PrintProductData[]>([])
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map())
  const [storeName, setStoreName] = useState("a:store")
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(() => {
    if (!templateId) {
      setError("Не указан шаблон")
      return
    }

    const raw = localStorage.getItem("printLabelsData")
    if (!raw) {
      setError("Нет данных для печати")
      return
    }

    localStorage.removeItem("printLabelsData")
    const printData: PrintLabelsData = JSON.parse(raw)

    if (!printData.items || printData.items.length === 0) {
      setError("Не выбраны товары")
      return
    }

    startTransition(async () => {
      try {
        const template = await getTemplate(templateId)
        const parsedLayout = template.layout as unknown as PriceLabelLayout
        setLayout(parsedLayout)
        setStoreName(template.storeName)

        const productIds = printData.items.map((i) => i.productId)
        const fetchedProducts = await getProductsForPrint(template.storeId, productIds)
        setProducts(fetchedProducts)

        const qtyMap = new Map(printData.items.map((i) => [i.productId, i.quantity]))
        setQuantities(qtyMap)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки")
      }
    })
  }, [templateId])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        {error}
      </div>
    )
  }

  if (isPending || !layout) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Загрузка...
      </div>
    )
  }

  // Build flat list of labels (product x quantity)
  const labels: PrintProductData[] = []
  for (const product of products) {
    const qty = quantities.get(product.id) ?? 1
    for (let i = 0; i < qty; i++) {
      labels.push(product)
    }
  }

  // Calculate grid: how many labels fit on A4 (210x297mm)
  const gap = 2
  const cols = Math.floor(210 / (layout.width + gap))
  const rows = Math.floor(297 / (layout.height + gap))
  const perPage = cols * rows

  // Split into pages
  const pages: PrintProductData[][] = []
  for (let i = 0; i < labels.length; i += perPage) {
    pages.push(labels.slice(i, i + perPage))
  }

  return (
    <PrintLayout title="Печать ценников">
      <div>
        {pages.map((pageLabels, pageIdx) => (
          <div
            key={pageIdx}
            style={{
              width: "210mm",
              height: "297mm",
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, ${layout.width}mm)`,
              gridTemplateRows: `repeat(${rows}, ${layout.height}mm)`,
              gap: `${gap}mm`,
              padding: `${gap}mm`,
              pageBreakAfter: pageIdx < pages.length - 1 ? "always" : undefined,
            }}
          >
            {pageLabels.map((product, labelIdx) => (
              <PriceLabelRenderer
                key={`${pageIdx}-${labelIdx}`}
                layout={layout}
                product={product}
                storeName={storeName}
                useMm
              />
            ))}
          </div>
        ))}
      </div>
    </PrintLayout>
  )
}
