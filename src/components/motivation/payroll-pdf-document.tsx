"use client"

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from "@react-pdf/renderer"

Font.register({
  family: "Roboto",
  fonts: [
    { src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf", fontWeight: 400 },
    { src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf", fontWeight: 700 },
  ],
})

interface PdfSaleItem {
  productName: string
  groupCode: string | null
  type: "PERCENT" | "FIXED"
  rate: number
  basis: "PROFIT" | "RETAIL_PRICE"
  commission: number
  sellPrice: number
  costPrice: number
}

interface PdfSaleCommission {
  saleNumber: string
  date: string
  items: PdfSaleItem[]
  totalCommission: number
}

interface PdfCrossSellBonus {
  saleNumber: string
  itemCount: number
  bonus: number
}

interface PdfRepairBonus {
  repairNumber: string
  date: string
  bonus: number
}

interface PdfReturnDeduction {
  saleNumber: string
  productName: string
  commission: number
}

export interface PdfBreakdown {
  dailyRate: { shiftsCount: number; ratePerShift: number; total: number }
  commissions: PdfSaleCommission[]
  crossSellBonuses: PdfCrossSellBonus[]
  repairBonuses: PdfRepairBonus[]
  returnDeductions: PdfReturnDeduction[]
  totals: {
    daily: number
    commissions: number
    crossBonuses: number
    repairBonuses: number
    returns: number
    total: number
  }
}

export interface PayrollPdfDocumentProps {
  userName: string
  storeName: string
  periodStart: string
  periodEnd: string
  isAdvance: boolean
  breakdown: PdfBreakdown
  advanceAmount?: number
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(n) + " ₽"
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU")
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Roboto", fontSize: 10 },
  header: { marginBottom: 20 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  meta: { fontSize: 9, color: "#666", marginBottom: 2 },
  section: { marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", padding: 8, backgroundColor: "#f9fafb" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  label: { color: "#374151" },
  value: { fontWeight: "bold" },
  valueNeg: { fontWeight: "bold", color: "#dc2626" },
  totalSection: { marginTop: 16, padding: 12, backgroundColor: "#f3f4f6", borderRadius: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalLabel: { fontSize: 13, fontWeight: "bold" },
  totalValue: { fontSize: 13, fontWeight: "bold" },
  subItem: { paddingLeft: 16, paddingVertical: 2 },
  subText: { fontSize: 8, color: "#6b7280" },
})

export function PayrollPdfDocument({
  userName,
  storeName,
  periodStart,
  periodEnd,
  isAdvance,
  breakdown,
  advanceAmount,
}: PayrollPdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>a:store — Расчётный лист</Text>
          <Text style={styles.meta}>Магазин: {storeName}</Text>
          <Text style={styles.meta}>Период: {formatDate(periodStart)} — {formatDate(periodEnd)}</Text>
          <Text style={styles.meta}>Сотрудник: {userName}</Text>
          <Text style={styles.meta}>Тип: {isAdvance ? "Аванс" : "Расчёт"}</Text>
        </View>

        {/* Daily Rate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ставка</Text>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.label}>
              {breakdown.dailyRate.shiftsCount} смен × {formatMoney(breakdown.dailyRate.ratePerShift)}
            </Text>
            <Text style={styles.value}>{formatMoney(breakdown.dailyRate.total)}</Text>
          </View>
        </View>

        {/* Commissions */}
        {breakdown.commissions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Комиссии с продаж</Text>
            {breakdown.commissions.map((sale, i) => (
              <View key={i}>
                <View style={[styles.row, styles.rowBorder]}>
                  <Text style={styles.label}>
                    Продажа №{sale.saleNumber} — {formatDate(sale.date)}
                  </Text>
                  <Text style={styles.value}>{formatMoney(sale.totalCommission)}</Text>
                </View>
                {sale.items.map((item, j) => (
                  <View key={j} style={styles.subItem}>
                    <Text style={styles.subText}>
                      {item.productName}
                      {item.groupCode ? ` [${item.groupCode}]` : ""}
                      {" — "}
                      {item.type === "FIXED"
                        ? `${formatMoney(item.rate)}/шт`
                        : `${(item.rate * 100).toFixed(1)}% ${item.basis === "PROFIT" ? "от прибыли" : "от цены"}`}
                      {" = "}
                      {formatMoney(item.commission)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Cross-sell */}
        {breakdown.crossSellBonuses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Кросс-продажи</Text>
            {breakdown.crossSellBonuses.map((cb, i) => (
              <View key={i} style={[styles.row, styles.rowBorder]}>
                <Text style={styles.label}>
                  Продажа №{cb.saleNumber} — {cb.itemCount} позиций
                </Text>
                <Text style={styles.value}>{formatMoney(cb.bonus)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Repairs */}
        {breakdown.repairBonuses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ремонты</Text>
            {breakdown.repairBonuses.map((rb, i) => (
              <View key={i} style={[styles.row, styles.rowBorder]}>
                <Text style={styles.label}>
                  Ремонт №{rb.repairNumber} — {formatDate(rb.date)}
                </Text>
                <Text style={styles.value}>{formatMoney(rb.bonus)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Returns */}
        {breakdown.returnDeductions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Возвраты (удержания)</Text>
            {breakdown.returnDeductions.map((rd, i) => (
              <View key={i} style={[styles.row, styles.rowBorder]}>
                <Text style={styles.label}>
                  {rd.productName} — по чеку №{rd.saleNumber}
                </Text>
                <Text style={styles.valueNeg}>{formatMoney(rd.commission)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Total */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Итого к начислению</Text>
            <Text style={styles.totalValue}>{formatMoney(breakdown.totals.total)}</Text>
          </View>
          {!isAdvance && advanceAmount != null && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.label}>Аванс выплачен</Text>
                <Text style={styles.value}>{formatMoney(advanceAmount)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>К выплате</Text>
                <Text style={styles.totalValue}>
                  {formatMoney(breakdown.totals.total - advanceAmount)}
                </Text>
              </View>
            </>
          )}
        </View>
      </Page>
    </Document>
  )
}
