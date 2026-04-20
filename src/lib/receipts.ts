/**
 * UX2-15: Агрегация оплат по методу для чека.
 *
 * В чеке должна быть одна строка на метод — даже если одна Sale
 * содержит несколько Payment того же метода (например, частичные оплаты
 * наличными). TRADE_IN отделяется и не смешивается с обычными методами.
 *
 * Порядок вывода фиксирован: CASH, CARD, SBP, TRANSFER, CREDIT, TRADE_IN.
 * Это же порядок используется в close-shift-dialog и в отчётах —
 * единая читаемость для операторов.
 */

export type PaymentMethodCode = "CASH" | "CARD" | "SBP" | "TRANSFER" | "CREDIT" | "TRADE_IN"

const METHOD_ORDER: readonly PaymentMethodCode[] = [
  "CASH",
  "CARD",
  "SBP",
  "TRANSFER",
  "CREDIT",
  "TRADE_IN",
] as const

/**
 * Человекочитаемые лейблы для методов оплаты — используются в чеке,
 * close-shift и отчётах. Единый источник правды, чтобы избежать
 * расхождений между компонентами.
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethodCode, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  SBP: "СБП",
  TRANSFER: "Перевод",
  CREDIT: "Рассрочка",
  TRADE_IN: "Trade-in",
}

export interface AggregatedPayment {
  method: PaymentMethodCode
  amount: number
}

/**
 * UX2-14: Возвращает код IMEI/SN для колонки чека.
 *
 * - Dual-SIM: "imei1, imei2"
 * - Single IMEI: "imei"
 * - Только serial number: "SN"
 * - Ничего нет: "—"
 */
export function formatSerialCode(item: {
  imei?: string | null
  imei2?: string | null
  serialNumber?: string | null
}): string {
  if (item.imei && item.imei2) return `${item.imei}, ${item.imei2}`
  if (item.imei) return item.imei
  if (item.serialNumber) return item.serialNumber
  return "—"
}

/**
 * Группирует массив payments по методу и суммирует amount.
 * Возвращает массив в фиксированном порядке METHOD_ORDER.
 * Методы без платежей в результат не попадают.
 *
 * Math: суммирование ведётся через number (.toFixed(2) для округления
 * финального значения, чтобы избежать float drift при нескольких
 * сложениях). Для Decimal-точности вызывающий код должен передавать
 * уже конвертированные (через `.toNumber()`) значения.
 */
export function aggregatePaymentsByMethod(
  payments: Array<{ method: string; amount: number }>,
): AggregatedPayment[] {
  const totals = new Map<PaymentMethodCode, number>()

  for (const p of payments) {
    const method = p.method as PaymentMethodCode
    if (!METHOD_ORDER.includes(method)) continue
    const current = totals.get(method) ?? 0
    totals.set(method, current + (Number.isFinite(p.amount) ? p.amount : 0))
  }

  const result: AggregatedPayment[] = []
  for (const method of METHOD_ORDER) {
    const amount = totals.get(method)
    if (amount === undefined) continue
    // Round to 2dp to collapse any floating-point drift from cents-level accumulation.
    result.push({ method, amount: Number(amount.toFixed(2)) })
  }
  return result
}
