"use client"

/**
 * INV-02, INV-08: Audit detail row visuals.
 *
 * - Shows SerialUnit status including MISSING and WRITTEN_OFF (INV-02)
 * - Renders soft-deleted StoreProduct with opacity-50 + "Удалён" badge (INV-08)
 *
 * Minimal presentational helpers consumed by audit-detail-client.tsx.
 */

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface AuditDetailRowProps {
  productName: string
  productSku?: string
  expectedQty: number
  actualQty: number | null
  difference: number | null
  deletedAt?: Date | string | null
}

export function AuditDetailRow({
  productName,
  productSku,
  expectedQty,
  actualQty,
  difference,
  deletedAt,
}: AuditDetailRowProps) {
  const isDeleted = Boolean(deletedAt)
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b px-2 py-2",
        isDeleted && "opacity-50",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{productName}</span>
        {productSku ? <span className="text-xs text-muted-foreground">{productSku}</span> : null}
        {isDeleted ? <Badge variant="destructive">Удалён</Badge> : null}
      </div>
      <div className="text-sm tabular-nums text-muted-foreground">
        <span>Ожидалось: {expectedQty}</span>
        <span className="mx-2">·</span>
        <span>Факт: {actualQty ?? "—"}</span>
        {difference !== null ? (
          <>
            <span className="mx-2">·</span>
            <span
              className={difference === 0 ? "" : difference < 0 ? "text-red-600" : "text-green-600"}
            >
              {difference > 0 ? "+" : ""}
              {difference}
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}

export type SerialStatusDisplay = "IN_STOCK" | "FOUND" | "MISSING" | "WRITTEN_OFF" | "SURPLUS"

export function SerialStatusBadge({ status }: { status: SerialStatusDisplay }) {
  const map: Record<
    SerialStatusDisplay,
    { label: string; variant: "default" | "destructive" | "outline" | "secondary" }
  > = {
    IN_STOCK: { label: "В наличии", variant: "secondary" },
    FOUND: { label: "Найден", variant: "default" },
    SURPLUS: { label: "Излишек", variant: "outline" },
    MISSING: { label: "Не найден", variant: "destructive" },
    WRITTEN_OFF: { label: "Списан", variant: "destructive" },
  }
  const info = map[status]
  return <Badge variant={info.variant}>{info.label}</Badge>
}
