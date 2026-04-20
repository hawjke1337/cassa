"use client"

/**
 * UX2-12: Полный бланк заказа для печати — A4 формат.
 *
 * Содержит все обязательные поля: реквизиты заказа, клиент, товары,
 * финансы (итого/предоплата/остаток), условия заказа
 * (сроки/возврат/гарантия) и место для подписей клиента и сотрудника.
 *
 * Блок "невозвратной предоплаты" отражает зафиксированное решение
 * проекта (project_prepayment_rule): предоплата не возвращается
 * автоматически при отмене — оператор принимает явное решение.
 */

import { formatMoney, formatDate } from "@/lib/format"

export interface OrderBlankItem {
  productName: string
  variant?: string | null
  price: number
  quantity: number
}

export interface OrderBlankCustomer {
  name: string
  phone: string
  email?: string | null
}

export interface OrderBlankProps {
  order: {
    id: string
    number: string
    createdAt: Date | string
    items: OrderBlankItem[]
    totalAmount: number
    prepaidAmount: number
    customer: OrderBlankCustomer
    deliveryDate?: Date | string | null
    notes?: string | null
    storeName?: string
    sellerName?: string
  }
}

export function OrderBlank({ order }: OrderBlankProps) {
  const remaining = Math.max(0, order.totalAmount - order.prepaidAmount)

  return (
    <article
      className="a4-blank mx-auto w-full max-w-[210mm] bg-white p-8 font-sans text-sm text-black print:p-0"
      aria-label={`Бланк заказа ${order.number}`}
    >
      <header className="mb-6 flex items-start justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Бланк заказа № {order.number}</h1>
          <div className="text-xs text-gray-600">Дата: {formatDate(order.createdAt)}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{order.storeName ?? "astore shop"}</div>
          {order.sellerName && (
            <div className="text-xs text-gray-600">Сотрудник: {order.sellerName}</div>
          )}
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold">Клиент</h2>
        <div className="grid grid-cols-2 gap-x-6 text-sm">
          <div>
            Имя: <strong>{order.customer.name}</strong>
          </div>
          <div>
            Телефон: <strong>{order.customer.phone}</strong>
          </div>
          {order.customer.email && (
            <div className="col-span-2">
              Email: <strong>{order.customer.email}</strong>
            </div>
          )}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold">Товары</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-1 text-left">Наименование</th>
              <th className="py-1 text-left">Вариант / цвет</th>
              <th className="py-1 text-right">Цена</th>
              <th className="py-1 text-center">Кол-во</th>
              <th className="py-1 text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i} className="border-b">
                <td className="py-1">{item.productName}</td>
                <td className="py-1">{item.variant ?? "—"}</td>
                <td className="py-1 text-right">{formatMoney(item.price)}</td>
                <td className="py-1 text-center">{item.quantity}</td>
                <td className="py-1 text-right">{formatMoney(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6 space-y-1">
        <div className="flex justify-between">
          <span>Итого:</span>
          <strong>{formatMoney(order.totalAmount)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Предоплата:</span>
          <strong>{formatMoney(order.prepaidAmount)}</strong>
        </div>
        <div className="flex justify-between border-t pt-1 text-base">
          <span>Остаток к доплате:</span>
          <strong>{formatMoney(remaining)}</strong>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold">Условия заказа</h2>
        <ul className="ml-5 list-disc space-y-1 text-xs">
          <li>
            Срок поставки: {order.deliveryDate ? formatDate(order.deliveryDate) : "уточняется"}
          </li>
          <li>
            Предоплата не возвращается автоматически при отмене заказа. При отмене оператор
            принимает явное решение об удержании или возврате предоплаты.
          </li>
          <li>Гарантия — согласно политике производителя.</li>
          <li>
            При получении клиент проверяет комплектность и внешний вид товара. Претензии к внешнему
            виду после получения не принимаются.
          </li>
          {order.notes && <li>Примечания: {order.notes}</li>}
        </ul>
      </section>

      <footer className="mt-12 flex justify-between">
        <div>
          <div className="mb-1 w-64 border-t border-black" />
          <div className="text-xs">Подпись клиента / дата</div>
        </div>
        <div>
          <div className="mb-1 w-64 border-t border-black" />
          <div className="text-xs">Подпись сотрудника / дата</div>
        </div>
      </footer>
    </article>
  )
}
