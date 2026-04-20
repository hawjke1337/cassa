"use client"

import { useEffect, useState, useTransition } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { getSerialUnitsForProduct } from "@/actions/serial-units"

interface SerialUnit {
  id: string
  imei: string | null
  imei2: string | null
  serialNumber: string | null
  status: string
  costPrice: number
}

interface SerialUnitPickerProps {
  storeId: string
  productId: string
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  maxSelection?: number
  onUnitsLoaded?: (
    units: Array<{
      id: string
      imei: string | null
      imei2: string | null
      serialNumber: string | null
    }>,
  ) => void
}

export function SerialUnitPicker({
  storeId,
  productId,
  selectedIds,
  onSelectionChange,
  maxSelection,
  onUnitsLoaded,
}: SerialUnitPickerProps) {
  const [units, setUnits] = useState<SerialUnit[]>([])
  const [isLoading, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const result = await getSerialUnitsForProduct(storeId, productId, "IN_STOCK")
      setUnits(result)
      onUnitsLoaded?.(
        result.map((u) => ({
          id: u.id,
          imei: u.imei,
          imei2: u.imei2,
          serialNumber: u.serialNumber,
        })),
      )
    })
  }, [storeId, productId, onUnitsLoaded])

  function toggleUnit(unitId: string) {
    if (selectedIds.includes(unitId)) {
      onSelectionChange(selectedIds.filter((id) => id !== unitId))
    } else {
      if (maxSelection && selectedIds.length >= maxSelection) return
      onSelectionChange([...selectedIds, unitId])
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 py-1">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
    )
  }

  if (units.length === 0) {
    return <p className="py-1 text-sm text-muted-foreground">Нет доступных единиц</p>
  }

  return (
    <div
      className="space-y-1.5 py-1"
      role="listbox"
      aria-label="Выбор серийного номера"
      aria-multiselectable="true"
    >
      {units.map((unit) => {
        const label = [
          unit.imei && `IMEI: ${unit.imei}`,
          unit.imei2 && `IMEI2: ${unit.imei2}`,
          unit.serialNumber && `SN: ${unit.serialNumber}`,
        ]
          .filter(Boolean)
          .join(" / ")

        return (
          <label
            key={unit.id}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
          >
            <Checkbox
              checked={selectedIds.includes(unit.id)}
              onCheckedChange={() => toggleUnit(unit.id)}
            />
            <span>{label || unit.id}</span>
          </label>
        )
      })}
    </div>
  )
}
