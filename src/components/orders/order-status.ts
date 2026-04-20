import type { CustomOrderStatus } from "@/generated/prisma/client"

export const STATUS_LABELS: Record<CustomOrderStatus, string> = {
  NEW: "Новый",
  PREPAID: "Предоплата",
  ORDERED: "Заказан",
  IN_TRANSIT: "В пути",
  ARRIVED: "Прибыл",
  READY_FOR_PICKUP: "Готов к выдаче",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
}

export const STATUS_COLORS: Record<CustomOrderStatus, string> = {
  NEW: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  PREPAID: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  ORDERED: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  IN_TRANSIT: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  ARRIVED: "bg-green-500/15 text-green-400 border-green-500/20",
  READY_FOR_PICKUP: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  COMPLETED: "bg-gray-500/15 text-gray-400 border-gray-500/20",
  CANCELLED: "bg-red-500/15 text-red-400 border-red-500/20",
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  SBP: "СБП",
  TRANSFER: "Перевод",
  CREDIT: "Кредит",
}
