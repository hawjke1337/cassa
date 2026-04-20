"use client"

import { useState, useTransition } from "react"
import { Search, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { searchByImei } from "@/actions/serial-units"
import { formatDate, formatMoney } from "@/lib/format"
import { SerialUnitHistory } from "@/components/serial/serial-unit-history"
import { toast } from "sonner"

interface ImeiSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SearchResult = Awaited<ReturnType<typeof searchByImei>>

const SERIAL_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  IN_STOCK: {
    label: "В наличии",
    className: "border-green-500 text-green-600 dark:text-green-400",
  },
  SOLD: {
    label: "Продано",
    className: "border-blue-500 text-blue-600 dark:text-blue-400",
  },
  IN_TRANSFER: {
    label: "В перемещении",
    className: "border-amber-500 text-amber-600 dark:text-amber-400",
  },
  WRITTEN_OFF: {
    label: "Списано",
    className: "border-red-500 text-red-600 dark:text-red-400",
  },
  IN_REPAIR: {
    label: "В ремонте",
    className: "border-purple-500 text-purple-600 dark:text-purple-400",
  },
}

export function ImeiSearchDialog({ open, onOpenChange }: ImeiSearchDialogProps) {
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<SearchResult | null>(null)
  const [searched, setSearched] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSearch() {
    const trimmed = query.trim()
    if (!trimmed) return

    startTransition(async () => {
      try {
        const data = await searchByImei(trimmed)
        setResult(data)
        setSearched(true)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Ошибка поиска")
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  function handleOpenChange(value: boolean) {
    onOpenChange(value)
    if (!value) {
      setQuery("")
      setResult(null)
      setSearched(false)
    }
  }

  const { serialUnit, deviceRecord } = result ?? {}
  const notFound = searched && !serialUnit && !deviceRecord

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Поиск по IMEI / SN</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="flex gap-2">
          <Input
            placeholder="Введите IMEI или серийный номер..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Button onClick={handleSearch} disabled={isPending || !query.trim()}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Найти
          </Button>
        </div>

        {/* Results */}
        {searched && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {notFound && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  IMEI не найден в системе
                </div>
              )}

              {/* SerialUnit result */}
              {serialUnit && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <span className="text-sm font-semibold">Товарная единица</span>
                    {(() => {
                      const cfg = SERIAL_STATUS_CONFIG[serialUnit.status]
                      return cfg ? (
                        <Badge variant="outline" className={cfg.className}>
                          {cfg.label}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{serialUnit.status}</Badge>
                      )
                    })()}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Товар: </span>
                      <span className="font-medium">{serialUnit.productName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Артикул: </span>
                      <span className="font-mono">{serialUnit.productSku}</span>
                    </div>
                    {serialUnit.imei && (
                      <div>
                        <span className="text-muted-foreground">IMEI: </span>
                        <span className="font-mono">{serialUnit.imei}</span>
                      </div>
                    )}
                    {serialUnit.imei2 && (
                      <div>
                        <span className="text-muted-foreground">IMEI 2: </span>
                        <span className="font-mono">{serialUnit.imei2}</span>
                      </div>
                    )}
                    {serialUnit.serialNumber && (
                      <div>
                        <span className="text-muted-foreground">Серийный номер: </span>
                        <span className="font-mono">{serialUnit.serialNumber}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Магазин: </span>
                      {serialUnit.storeName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Себестоимость: </span>
                      {formatMoney(serialUnit.costPrice)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Гарантия: </span>
                      {serialUnit.warrantyDays} дн.
                    </div>
                  </div>

                  {/* Sale info */}
                  {serialUnit.sale && (
                    <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                        Продажа
                      </div>
                      <div>
                        <span className="text-muted-foreground">Номер: </span>
                        <span className="font-mono">{serialUnit.sale.saleNumber}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Дата: </span>
                        {formatDate(serialUnit.sale.saleDate)}
                      </div>
                    </div>
                  )}

                  {/* Warranty claims */}
                  {serialUnit.warrantyClaims.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">
                        Гарантийные обращения ({serialUnit.warrantyClaims.length})
                      </div>
                      <div className="space-y-1">
                        {serialUnit.warrantyClaims.map((wc) => (
                          <div
                            key={wc.id}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <span className="font-mono">{wc.number}</span>
                            <span>&middot;</span>
                            <span>{wc.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* History */}
                  {serialUnit.history.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">История устройства</div>
                      <SerialUnitHistory history={serialUnit.history} />
                    </div>
                  )}
                </div>
              )}

              {/* DeviceRecord result */}
              {deviceRecord && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <span className="text-sm font-semibold">Запись устройства</span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Тип: </span>
                      {deviceRecord.deviceType}
                    </div>
                    {deviceRecord.brand && (
                      <div>
                        <span className="text-muted-foreground">Бренд: </span>
                        {deviceRecord.brand}
                      </div>
                    )}
                    {deviceRecord.model && (
                      <div>
                        <span className="text-muted-foreground">Модель: </span>
                        {deviceRecord.model}
                      </div>
                    )}
                    {deviceRecord.imei && (
                      <div>
                        <span className="text-muted-foreground">IMEI: </span>
                        <span className="font-mono">{deviceRecord.imei}</span>
                      </div>
                    )}
                    {deviceRecord.imei2 && (
                      <div>
                        <span className="text-muted-foreground">IMEI 2: </span>
                        <span className="font-mono">{deviceRecord.imei2}</span>
                      </div>
                    )}
                    {deviceRecord.serialNumber && (
                      <div>
                        <span className="text-muted-foreground">Серийный номер: </span>
                        <span className="font-mono">{deviceRecord.serialNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Customer info */}
                  {deviceRecord.customer && (
                    <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                        Клиент
                      </div>
                      <div className="font-medium">{deviceRecord.customer.name}</div>
                      {deviceRecord.customer.phone && (
                        <div className="text-muted-foreground">
                          {deviceRecord.customer.phone}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Repairs */}
                  {deviceRecord.repairs.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">
                        Ремонты ({deviceRecord.repairs.length})
                      </div>
                      <div className="space-y-1">
                        {deviceRecord.repairs.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <span className="font-mono text-xs">{r.id.slice(0, 8)}</span>
                            <span>&middot;</span>
                            <span>{r.status}</span>
                            <span>&middot;</span>
                            <span>{formatDate(r.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trade-ins */}
                  {deviceRecord.tradeIns.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">
                        Трейд-ин ({deviceRecord.tradeIns.length})
                      </div>
                      <div className="space-y-1">
                        {deviceRecord.tradeIns.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <span className="font-mono text-xs">{t.id.slice(0, 8)}</span>
                            <span>&middot;</span>
                            <span>{t.status}</span>
                            <span>&middot;</span>
                            <span>{formatDate(t.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
