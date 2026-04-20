"use client"

import { useCallback, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { ImeiScannerInput } from "./imei-scanner-input"

export interface SerialEntry {
  imei?: string | null
  imei2?: string | null
  serialNumber?: string | null
  costPrice: number
}

interface SerialEntryRowsProps {
  quantity: number
  identifierType: "IMEI" | "SN" | "BOTH"
  baseCostPrice: number
  entries: SerialEntry[]
  onEntriesChange: (entries: SerialEntry[]) => void
}

export function SerialEntryRows({
  quantity,
  identifierType,
  baseCostPrice,
  entries,
  onEntriesChange,
}: SerialEntryRowsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  // Resize entries array only when quantity changes
  useEffect(() => {
    const current = entriesRef.current
    if (current.length === quantity) return

    const newEntries = [...current]
    while (newEntries.length < quantity) {
      newEntries.push({
        imei: null,
        imei2: null,
        serialNumber: null,
        costPrice: baseCostPrice,
      })
    }
    if (newEntries.length > quantity) {
      newEntries.length = quantity
    }
    onEntriesChange(newEntries)
  }, [quantity, baseCostPrice, onEntriesChange])

  const updateEntry = useCallback(
    (index: number, field: keyof SerialEntry, value: string | number | null) => {
      const updated = entries.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      )
      onEntriesChange(updated)
    },
    [entries, onEntriesChange]
  )

  const showImei = identifierType === "IMEI" || identifierType === "BOTH"
  const showSn = identifierType === "SN" || identifierType === "BOTH"

  return (
    <div ref={containerRef} className="pl-8 pr-4 py-2 space-y-2 bg-muted/30 border-t">
      <div className="text-xs text-muted-foreground font-medium mb-1">
        Серийные номера ({entries.length}/{quantity})
      </div>
      {entries.map((entry, index) => (
        <div key={index} data-serial-row={index} className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground mt-2 w-6 text-right shrink-0">
            {index + 1}.
          </span>
          {showImei && (
            <div className="flex-1 min-w-0">
              <ImeiScannerInput
                identifierType={identifierType}
                fieldName="imei"
                value={entry.imei || ""}
                onChange={(v) => updateEntry(index, "imei", v || null)}
                onEnter={() => {
                  const row = containerRef.current?.querySelector(`[data-serial-row="${index + 1}"]`)
                  const input = row?.querySelector("input")
                  ;(input as HTMLInputElement | null)?.focus()
                }}
                placeholder="IMEI"
                autoFocus={index === 0 && !entry.imei}
              />
            </div>
          )}
          {showImei && identifierType === "BOTH" && (
            <div className="flex-1 min-w-0">
              <ImeiScannerInput
                identifierType={identifierType}
                fieldName="imei2"
                value={entry.imei2 || ""}
                onChange={(v) => updateEntry(index, "imei2", v || null)}
                placeholder="IMEI 2"
              />
            </div>
          )}
          {showSn && (
            <div className="flex-1 min-w-0">
              <Input
                value={entry.serialNumber || ""}
                onChange={(e) =>
                  updateEntry(index, "serialNumber", e.target.value || null)
                }
                placeholder="Серийный номер"
                className="h-8"
              />
            </div>
          )}
          <div className="w-28 shrink-0">
            <Input
              type="number"
              min={0}
              step={0.01}
              value={entry.costPrice}
              onChange={(e) =>
                updateEntry(index, "costPrice", parseFloat(e.target.value) || 0)
              }
              className="h-8"
              placeholder="Цена"
            />
          </div>
        </div>
      ))}
    </div>
  )
}
