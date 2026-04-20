"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { SIZE_PRESETS } from "@/components/price-labels/label-constants"
import type { PriceLabelLayout } from "@/lib/validations/price-labels"

interface LabelSettingsPanelProps {
  name: string
  onNameChange: (name: string) => void
  layout: PriceLabelLayout
  onLayoutChange: (layout: PriceLabelLayout) => void
}

export function LabelSettingsPanel({
  name,
  onNameChange,
  layout,
  onLayoutChange,
}: LabelSettingsPanelProps) {
  const currentPreset = SIZE_PRESETS.find(
    (p) => p.width === layout.width && p.height === layout.height
  )
  const sizeValue = currentPreset
    ? `${currentPreset.width}x${currentPreset.height}`
    : "custom"

  function handleSizeChange(value: string) {
    if (value === "custom") return
    const [w, h] = value.split("x").map(Number)
    onLayoutChange({ ...layout, width: w, height: h })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Название шаблона</Label>
        <Input value={name} onChange={(e) => onNameChange(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Размер ценника</Label>
        <RadioGroup value={sizeValue} onValueChange={handleSizeChange}>
          {SIZE_PRESETS.map((preset) => (
            <div key={`${preset.width}x${preset.height}`} className="flex items-center gap-2">
              <RadioGroupItem value={`${preset.width}x${preset.height}`} id={`size-${preset.width}x${preset.height}`} />
              <Label htmlFor={`size-${preset.width}x${preset.height}`}>{preset.label}</Label>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <RadioGroupItem value="custom" id="size-custom" />
            <Label htmlFor="size-custom">Свой размер</Label>
          </div>
        </RadioGroup>
        {sizeValue === "custom" && (
          <div className="flex items-center gap-2 pt-2">
            <Input
              type="number"
              min={20}
              max={200}
              value={layout.width}
              onChange={(e) =>
                onLayoutChange({ ...layout, width: Number(e.target.value) || 20 })
              }
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">x</span>
            <Input
              type="number"
              min={15}
              max={200}
              value={layout.height}
              onChange={(e) =>
                onLayoutChange({ ...layout, height: Number(e.target.value) || 15 })
              }
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">мм</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Источник штрих-кода</Label>
        <RadioGroup
          value={layout.barcodeSource}
          onValueChange={(v) =>
            onLayoutChange({ ...layout, barcodeSource: v as "ean" | "sku" })
          }
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="ean" id="barcode-ean" />
            <Label htmlFor="barcode-ean">Штрих-код товара (EAN-13)</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="sku" id="barcode-sku" />
            <Label htmlFor="barcode-sku">Артикул (Code128)</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  )
}
