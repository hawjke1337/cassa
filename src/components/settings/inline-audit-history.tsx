"use client"

import { useEffect, useState, useTransition } from "react"
import { fetchEntityAuditLogs } from "@/actions/audit"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { History, Loader2 } from "lucide-react"
import Link from "next/link"

interface InlineAuditHistoryProps {
  entity: string
  entityId: string
  title?: string
}

type AuditItem = Awaited<ReturnType<typeof fetchEntityAuditLogs>>["items"][number]

const ACTION_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CREATE: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
  ROLE_CHANGE: "outline",
  PERMISSION_CHANGE: "outline",
}

function formatRelativeDate(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "только что"
  if (diffMin < 60) return `${diffMin} мин. назад`
  if (diffHours < 24) return `${diffHours} ч. назад`
  if (diffDays === 1) return "вчера"
  if (diffDays < 7) return `${diffDays} дн. назад`
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatChanges(changes: unknown): string | null {
  if (!changes || typeof changes !== "object") return null
  const entries = Object.entries(changes as Record<string, { old: unknown; new: unknown }>)
  if (entries.length === 0) return null
  return entries
    .slice(0, 3)
    .map(([field, val]) => `${field}: ${String(val.old ?? "null")} -> ${String(val.new ?? "null")}`)
    .join("; ")
}

export function InlineAuditHistory({
  entity,
  entityId,
  title = "История изменений",
}: InlineAuditHistoryProps) {
  const [items, setItems] = useState<AuditItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await fetchEntityAuditLogs({ entity, entityId, page: 1, pageSize: 10 })
        setItems(result.items)
        setTotal(result.total)
        setLoaded(true)
      } catch {
        setLoaded(true)
      }
    })
  }, [entity, entityId])

  const loadMore = () => {
    const nextPage = page + 1
    startTransition(async () => {
      try {
        const result = await fetchEntityAuditLogs({
          entity,
          entityId,
          page: nextPage,
          pageSize: 10,
        })
        setItems((prev) => [...prev, ...result.items])
        setPage(nextPage)
      } catch {
        // ignore
      }
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <History className="size-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!loaded && isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="size-3 animate-spin" />
            Загрузка...
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Нет записей</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const changesSummary = formatChanges(item.changes)
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-2 border-b pb-2 last:border-0 text-sm"
                >
                  <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[80px]">
                    {formatRelativeDate(item.createdAt)}
                  </span>
                  <Badge
                    variant={ACTION_BADGE_VARIANT[item.action] ?? "secondary"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {item.action}
                  </Badge>
                  <span className="text-xs">
                    {item.user.firstName} {item.user.lastName}
                  </span>
                  {changesSummary && (
                    <span className="text-xs text-muted-foreground truncate" title={changesSummary}>
                      {changesSummary}
                    </span>
                  )}
                </div>
              )
            })}

            <div className="flex items-center justify-between pt-1">
              {items.length < total && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={loadMore}
                  disabled={isPending}
                >
                  {isPending ? "Загрузка..." : "Загрузить ещё"}
                </Button>
              )}
              <Link
                href={`/settings/audit-log?entity=${entity}&entityId=${entityId}`}
                className="text-xs text-primary hover:underline"
              >
                Показать все
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
