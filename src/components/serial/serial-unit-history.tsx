"use client"

import { formatDate } from "@/lib/format"

interface SerialUnitHistoryProps {
  history: Array<{
    id: string
    event: string
    storeName: string
    performedBy: string
    relatedDocument: string | null
    relatedDocType: string | null
    comment: string | null
    createdAt: string
  }>
}

const EVENT_LABELS: Record<string, string> = {
  RECEIVED: "Получено",
  TRANSFERRED_OUT: "Перемещено (исх.)",
  TRANSFERRED_IN: "Перемещено (вх.)",
  SOLD: "Продано",
  RETURNED: "Возврат",
  WRITTEN_OFF: "Списано",
  REPAIR_IN: "Принято в ремонт",
  REPAIR_OUT: "Выдано из ремонта",
  COST_ADJUSTED: "Корректировка цены",
  IMEI_CORRECTED: "Исправление IMEI",
}

const EVENT_DOT_COLORS: Record<string, string> = {
  RECEIVED: "bg-green-500",
  IN_STOCK: "bg-green-500",
  TRANSFERRED_IN: "bg-blue-500",
  TRANSFERRED_OUT: "bg-blue-500",
  SOLD: "bg-red-500",
  WRITTEN_OFF: "bg-red-500",
  RETURNED: "bg-amber-500",
  REPAIR_IN: "bg-purple-500",
  REPAIR_OUT: "bg-purple-500",
  COST_ADJUSTED: "bg-gray-500",
  IMEI_CORRECTED: "bg-gray-500",
}

export function SerialUnitHistory({ history }: SerialUnitHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">История отсутствует</div>
    )
  }

  return (
    <div className="relative space-y-3 pl-4">
      <div className="absolute left-1.5 top-2 h-[calc(100%-16px)] w-px bg-border" />
      {history.map((entry) => {
        const dotColor = EVENT_DOT_COLORS[entry.event] ?? "bg-muted-foreground"
        return (
          <div key={entry.id} className="relative flex gap-3">
            <div className={`absolute -left-2.5 mt-1.5 size-2 rounded-full ${dotColor}`} />
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {EVENT_LABELS[entry.event] ?? entry.event}
              </div>
              <div className="text-xs text-muted-foreground">
                {entry.storeName} &middot; {entry.performedBy}
                {entry.relatedDocument && (
                  <> &middot; {entry.relatedDocument}</>
                )}
              </div>
              {entry.comment && (
                <div className="text-xs text-muted-foreground">{entry.comment}</div>
              )}
              <div className="text-xs text-muted-foreground">
                {formatDate(entry.createdAt)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
