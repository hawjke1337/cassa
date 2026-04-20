"use client"

import { formatDate } from "@/lib/format"
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS } from "./repair-status"
import type { RepairStatus } from "@/generated/prisma/client"
import {
  CirclePlus,
  Search,
  Clock,
  CheckCircle,
  Wrench,
  CircleCheck,
  HandCoins,
  PackageCheck,
  CircleX,
} from "lucide-react"

const STATUS_ICONS: Record<RepairStatus, React.ComponentType<{ className?: string }>> = {
  RECEIVED: CirclePlus,
  DIAGNOSING: Search,
  WAITING_APPROVAL: Clock,
  APPROVED: CheckCircle,
  IN_PROGRESS: Wrench,
  COMPLETED: CircleCheck,
  READY_FOR_PICKUP: HandCoins,
  DELIVERED: PackageCheck,
  CANCELLED: CircleX,
}

interface StatusEntry {
  id: string
  status: string
  comment: string | null
  changedByName: string
  createdAt: string
}

interface RepairTimelineProps {
  history: StatusEntry[]
  currentStatus: string
}

export function RepairTimeline({ history, currentStatus }: RepairTimelineProps) {
  return (
    <div className="relative space-y-0">
      {history.map((entry, idx) => {
        const status = entry.status as RepairStatus
        const Icon = STATUS_ICONS[status] ?? CirclePlus
        const isCurrent = idx === history.length - 1 && status === currentStatus
        const colorClass = REPAIR_STATUS_COLORS[status]

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
                  {REPAIR_STATUS_LABELS[status]}
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
