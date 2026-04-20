import type { RepairStatus } from "@/generated/prisma/client"

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  RECEIVED: "Принят",
  DIAGNOSING: "Диагностика",
  WAITING_APPROVAL: "Ожидает согласования",
  APPROVED: "Согласован",
  IN_PROGRESS: "В работе",
  COMPLETED: "Выполнен",
  READY_FOR_PICKUP: "Готов к выдаче",
  DELIVERED: "Выдан",
  CANCELLED: "Отменён",
}

export const REPAIR_STATUS_COLORS: Record<RepairStatus, string> = {
  RECEIVED: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  DIAGNOSING: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  WAITING_APPROVAL: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  APPROVED: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  IN_PROGRESS: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  COMPLETED: "bg-green-500/15 text-green-400 border-green-500/20",
  READY_FOR_PICKUP: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  DELIVERED: "bg-gray-500/15 text-gray-400 border-gray-500/20",
  CANCELLED: "bg-red-500/15 text-red-400 border-red-500/20",
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  SBP: "СБП",
  TRANSFER: "Перевод",
  CREDIT: "Кредит",
}
