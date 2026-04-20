"use client"

import { useEffect, useRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import JsBarcode from "jsbarcode"
import { formatMoney, formatDate } from "@/lib/format"
import type { PriceLabelLayout, ZoneElement, PrintProductData } from "@/lib/validations/price-labels"
import { MM_TO_PX } from "@/components/price-labels/label-constants"

interface LabelRendererProps {
  layout: PriceLabelLayout
  product?: PrintProductData
  storeName?: string
  scale?: number
  useMm?: boolean
}

function BarcodeElement({
  value,
  format,
  width,
}: {
  value: string
  format: "EAN13" | "CODE128"
  width: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !value) return
    try {
      JsBarcode(svgRef.current, value, {
        format,
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 10,
        margin: 0,
      })
    } catch {
      // Invalid barcode — clear by removing child nodes safely
      while (svgRef.current.firstChild) {
        svgRef.current.removeChild(svgRef.current.firstChild)
      }
    }
  }, [value, format])

  if (!value) {
    return (
      <span className="text-xs text-muted-foreground">Нет штрих-кода</span>
    )
  }

  return <svg ref={svgRef} style={{ maxWidth: width, height: "auto" }} />
}

function renderElement(
  element: ZoneElement,
  product: PrintProductData | undefined,
  storeName: string,
  layout: PriceLabelLayout,
  containerWidth: number
) {
  const style: React.CSSProperties = {
    fontSize: `${element.fontSize}px`,
    fontWeight: element.fontWeight,
    textAlign: element.textAlign,
    width: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }

  const demoProduct: PrintProductData = {
    id: "demo",
    name: "iPhone 15 Pro Max 256GB",
    sku: "IP15PM-256",
    barcode: "4680000000001",
    sellPrice: 89990,
    oldPrice: 99990,
  }

  const p = product ?? demoProduct

  const flexAlign = element.textAlign === "center"
    ? "center"
    : element.textAlign === "right"
      ? "flex-end"
      : "flex-start"

  switch (element.type) {
    case "productName":
      return <div key={element.id} style={style}>{p.name}</div>
    case "price":
      return <div key={element.id} style={style}>{formatMoney(p.sellPrice)}</div>
    case "oldPrice":
      if (!p.oldPrice) return null
      return (
        <div key={element.id} style={{ ...style, textDecoration: "line-through", opacity: 0.6 }}>
          {formatMoney(p.oldPrice)}
        </div>
      )
    case "sku":
      return <div key={element.id} style={style}>{p.sku}</div>
    case "barcode": {
      const barcodeValue = layout.barcodeSource === "ean" ? p.barcode : p.sku
      const format = layout.barcodeSource === "ean" ? "EAN13" : "CODE128"
      return (
        <div key={element.id} style={{ ...style, display: "flex", justifyContent: flexAlign }}>
          <BarcodeElement value={barcodeValue ?? ""} format={format} width={containerWidth} />
        </div>
      )
    }
    case "storeName":
      return <div key={element.id} style={style}>{storeName}</div>
    case "date":
      return <div key={element.id} style={style}>{formatDate(new Date())}</div>
    case "logo":
      if (!element.value) return null
      return (
        <div key={element.id} style={{ ...style, display: "flex", justifyContent: flexAlign }}>
          <img src={element.value} alt="Logo" style={{ maxHeight: `${element.fontSize * 2}px`, objectFit: "contain" }} />
        </div>
      )
    case "text":
      return <div key={element.id} style={style}>{element.value ?? ""}</div>
    case "qrCode":
      return (
        <div key={element.id} style={{ ...style, display: "flex", justifyContent: flexAlign }}>
          <QRCodeSVG value={element.value ?? "https://example.com"} size={element.fontSize * 3} />
        </div>
      )
    default:
      return null
  }
}

export function PriceLabelRenderer({
  layout,
  product,
  storeName = "a:store",
  scale = 1,
  useMm = false,
}: LabelRendererProps) {
  const unit = useMm ? "mm" : "px"
  const w = useMm ? layout.width : layout.width * MM_TO_PX * scale
  const h = useMm ? layout.height : layout.height * MM_TO_PX * scale
  const containerWidth = useMm ? layout.width * MM_TO_PX : w
  const padding = useMm ? 2 : 2 * MM_TO_PX * scale

  return (
    <div
      style={{
        width: `${w}${unit}`,
        height: `${h}${unit}`,
        padding: `${padding}${useMm ? "mm" : "px"}`,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        backgroundColor: "white",
        boxSizing: "border-box",
      }}
    >
      {layout.zones.header.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          {layout.zones.header.map((el) =>
            renderElement(el, product, storeName, layout, containerWidth)
          )}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {layout.zones.body.map((el) =>
          renderElement(el, product, storeName, layout, containerWidth)
        )}
      </div>

      {layout.zones.footer.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          {layout.zones.footer.map((el) =>
            renderElement(el, product, storeName, layout, containerWidth)
          )}
        </div>
      )}

      {layout.zones.header.length === 0 &&
        layout.zones.body.length === 0 &&
        layout.zones.footer.length === 0 && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "12px" }}>
          Добавьте элементы
        </div>
      )}
    </div>
  )
}
