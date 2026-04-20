"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { formatMoney, formatDate } from "@/lib/format"
import { Printer } from "lucide-react"
import {
  aggregatePaymentsByMethod,
  formatSerialCode,
  PAYMENT_METHOD_LABELS,
  type PaymentMethodCode,
} from "@/lib/receipts"
import { PrintPreviewDialog } from "@/components/print/print-preview-dialog"

interface ReceiptItem {
  productName: string
  productSku: string
  quantity: number
  price: number
  discount: number
  total: number
  imei?: string | null
  imei2?: string | null
  serialNumber?: string | null
}

interface ReceiptPayment {
  method: string
  amount: number
}

interface ReceiptData {
  id: string
  number: string
  createdAt: string
  sellerName: string
  storeName: string
  storeAddress: string | null
  storePhone: string | null
  items: ReceiptItem[]
  payments: ReceiptPayment[]
  totalAmount: number
  discountAmount: number
  finalAmount: number
}

interface ReceiptViewProps {
  data: ReceiptData
  onClose?: () => void
}

/**
 * UX2-14/15/10: чек с отдельной колонкой IMEI/SN, агрегацией платежей
 * по методу и print preview перед window.print().
 */
export function ReceiptView({ data, onClose }: ReceiptViewProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  const aggregatedPayments = aggregatePaymentsByMethod(data.payments)

  const receiptBody = (
    <div
      id="receipt-content"
      className="mx-auto w-full max-w-sm rounded-lg border bg-white p-6 font-mono text-xs text-black print:border-none print:p-0 print:shadow-none"
    >
      {/* Store header */}
      <div className="mb-3 text-center">
        <p className="text-sm font-bold">{data.storeName}</p>
        {data.storeAddress && <p className="text-[10px] text-gray-600">{data.storeAddress}</p>}
        {data.storePhone && <p className="text-[10px] text-gray-600">Тел: {data.storePhone}</p>}
      </div>

      <div className="mb-3 border-b border-dashed border-gray-400 pb-1 text-center">
        <p className="text-sm font-bold tracking-wider">ТОВАРНЫЙ ЧЕК</p>
      </div>

      {/* Sale info */}
      <div className="mb-3 space-y-0.5">
        <p>Чек: {data.number}</p>
        <p>Дата: {formatDate(data.createdAt)}</p>
        <p>Продавец: {data.sellerName}</p>
      </div>

      <div className="mb-2 border-b border-dashed border-gray-400" />

      {/* Items table — UX2-14: отдельная колонка IMEI/SN */}
      <table className="mb-3 w-full">
        <thead>
          <tr className="border-b border-gray-300 text-left">
            <th className="pb-1 font-medium">Товар</th>
            <th className="pb-1 text-left font-medium">IMEI/SN</th>
            <th className="pb-1 text-center font-medium">Кол</th>
            <th className="pb-1 text-right font-medium">Цена</th>
            <th className="pb-1 text-right font-medium">Итого</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={idx} className="border-b border-dotted border-gray-200">
              <td className="max-w-[120px] py-0.5">
                <div className="truncate">{item.productName}</div>
                {item.discount > 0 && (
                  <div className="text-[9px] text-gray-500">
                    Скидка: -{formatMoney(item.discount)}
                  </div>
                )}
              </td>
              <td className="py-0.5 text-left text-[10px]">{formatSerialCode(item)}</td>
              <td className="py-0.5 text-center">{item.quantity}</td>
              <td className="py-0.5 text-right">{item.price.toLocaleString("ru-RU")}</td>
              <td className="py-0.5 text-right">{item.total.toLocaleString("ru-RU")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-2 border-b border-dashed border-gray-400" />

      {/* Totals */}
      <div className="mb-3 space-y-0.5">
        <div className="flex justify-between">
          <span>Подитог:</span>
          <span>{formatMoney(data.totalAmount)}</span>
        </div>
        {data.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>Скидка:</span>
            <span>-{formatMoney(data.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold">
          <span>ИТОГО:</span>
          <span>{formatMoney(data.finalAmount)}</span>
        </div>
      </div>

      <div className="mb-2 border-b border-dashed border-gray-400" />

      {/* Payments — UX2-15: одна строка на метод (агрегация) */}
      <div className="mb-3 space-y-0.5">
        <p className="font-medium">Оплата:</p>
        {aggregatedPayments.map((payment) => (
          <div key={payment.method} className="flex justify-between">
            <span>
              {PAYMENT_METHOD_LABELS[payment.method as PaymentMethodCode] ?? payment.method}:
            </span>
            <span>{formatMoney(payment.amount)}</span>
          </div>
        ))}
      </div>

      <div className="mb-2 border-b border-dashed border-gray-400" />

      <p className="mt-4 text-center text-[10px] text-gray-500">Спасибо за покупку!</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="print:block hidden" />
      {receiptBody}

      {/* Print / Close buttons - hidden from print */}
      <div className="flex justify-center gap-2 print:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreviewOpen(true)}
          aria-label="Открыть превью печати чека"
        >
          <Printer className="mr-1 size-4" />
          Печать
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`/print/sale/${data.id}`, "_blank")}
          aria-label="Открыть печатную версию A4"
        >
          <Printer className="mr-1 size-4" />
          Печать (A4)
        </Button>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Закрыть чек">
            Закрыть
          </Button>
        )}
      </div>

      {/* UX2-10: Print preview перед window.print() */}
      <PrintPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={`Чек ${data.number}`}
      >
        {receiptBody}
      </PrintPreviewDialog>
    </div>
  )
}
