"use client"

import { formatDate } from "@/lib/format"
import { STATUS_LABELS, STATUS_COLORS } from "./order-status"
import type { CustomOrderStatus } from "@/generated/prisma/client"
import {
  CirclePlus,
  CreditCard,
  Package,
  Truck,
  PackageCheck,
  HandCoins,
  CircleCheck,
  CircleX,
} from "lucide-react"

const STATUS_ICONS: Record<CustomOrderStatus, React.ComponentType<{ className?: string }>> = {
  NEW: CirclePlus,
  PREPAID: CreditCard,
  ORDERED: Package,
  IN_TRANSIT: Truck,
  ARRIVED: PackageCheck,
  READY_FOR_PICKUP: HandCoins,
  COMPLETED: CircleCheck,
  CANCELLED: CircleX,
}

interface StatusEntry {
  id: string
  status: string
  comment: string | null
  changedByName: string
  createdAt: string
}

interface OrderTimelineProps {
  history: StatusEntry[]
  currentStatus: string
}

export function OrderTimeline({ history, currentStatus }: OrderTimelineProps) {
  return (
    <div className="relative space-y-0">
      {history.map((entry, idx) => {
        const status = entry.status as CustomOrderStatus
        const Icon = STATUS_ICONS[status] ?? CirclePlus
        const isCurrent = idx === history.length - 1 && status === currentStatus
        const colorClass = STATUS_COLORS[status]

        return (
          <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Vertical line */}
            {idx < history.length - 1 && (
              <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-border" />
            )}

            {/* Icon */}
            <div
              className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${
                isCurrent
                  ? colorClass
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {STATUS_LABELS[status]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(entry.createdAt)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {entry.changedByName}
              </div>
              {entry.comment && (
                <div className="mt-1 text-sm text-muted-foreground">
                  {entry.comment}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
