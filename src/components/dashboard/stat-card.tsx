"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string
  change?: number | null
  icon?: React.ReactNode
  description?: string
  valueClassName?: string
}

export function StatCard({
  title,
  value,
  change,
  icon,
  description,
  valueClassName,
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        {change != null && (
          <p
            className={cn(
              "mt-1 text-xs",
              change > 0 ? "text-green-400" : change < 0 ? "text-red-400" : "text-muted-foreground",
            )}
          >
            {change > 0 ? "+" : ""}
            {change}% к вчера
          </p>
        )}
      </CardContent>
    </Card>
  )
}
