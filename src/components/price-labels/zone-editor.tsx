"use client"

import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { GripVertical, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ElementSettings } from "@/components/price-labels/element-settings"
import { ELEMENT_TYPE_LABELS, createDefaultElement } from "@/components/price-labels/label-constants"
import { ELEMENT_TYPES, type ZoneElement, type PriceLabelLayout, type ElementType } from "@/lib/validations/price-labels"
import { useState } from "react"

type ZoneName = "header" | "body" | "footer"

const ZONE_LABELS: Record<ZoneName, string> = {
  header: "Шапка",
  body: "Основное",
  footer: "Подвал",
}

interface ZoneEditorProps {
  layout: PriceLabelLayout
  onLayoutChange: (layout: PriceLabelLayout) => void
}

function ZoneSection({
  zoneName,
  elements,
  onAdd,
  onUpdate,
  onDelete,
}: {
  zoneName: ZoneName
  elements: ZoneElement[]
  onAdd: (type: ElementType) => void
  onUpdate: (idx: number, el: ZoneElement) => void
  onDelete: (idx: number) => void
}) {
  const [addType, setAddType] = useState<string>("")

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {ZONE_LABELS[zoneName]}
      </h4>

      <Droppable droppableId={zoneName}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 min-h-[40px]">
            {elements.map((el, idx) => (
              <Draggable key={el.id} draggableId={el.id} index={idx}>
                {(dragProvided) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    className="flex items-start gap-1"
                  >
                    <div
                      {...dragProvided.dragHandleProps}
                      className="mt-3 cursor-grab text-muted-foreground"
                    >
                      <GripVertical className="size-4" />
                    </div>
                    <div className="flex-1">
                      <ElementSettings
                        element={el}
                        onChange={(updated) => onUpdate(idx, updated)}
                        onDelete={() => onDelete(idx)}
                      />
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="flex items-center gap-2">
        <Select value={addType} onValueChange={(val) => setAddType(val ?? "")}>
          <SelectTrigger className="h-8 flex-1">
            <SelectValue placeholder="Добавить элемент..." />
          </SelectTrigger>
          <SelectContent>
            {ELEMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {ELEMENT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={!addType}
          onClick={() => {
            if (addType) {
              onAdd(addType as ElementType)
              setAddType("")
            }
          }}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function ZoneEditor({ layout, onLayoutChange }: ZoneEditorProps) {
  function handleDragEnd(result: DropResult) {
    const { source, destination } = result
    if (!destination) return

    const sourceZone = source.droppableId as ZoneName
    const destZone = destination.droppableId as ZoneName

    const newZones = {
      header: [...layout.zones.header],
      body: [...layout.zones.body],
      footer: [...layout.zones.footer],
    }

    if (sourceZone === destZone) {
      const items = newZones[sourceZone]
      const [moved] = items.splice(source.index, 1)
      items.splice(destination.index, 0, moved)
    } else {
      const sourceItems = newZones[sourceZone]
      const destItems = newZones[destZone]
      const [moved] = sourceItems.splice(source.index, 1)
      destItems.splice(destination.index, 0, moved)
    }

    onLayoutChange({ ...layout, zones: newZones })
  }

  function handleAdd(zone: ZoneName, type: ElementType) {
    const newZones = {
      header: [...layout.zones.header],
      body: [...layout.zones.body],
      footer: [...layout.zones.footer],
    }
    newZones[zone] = [...newZones[zone], createDefaultElement(type)]
    onLayoutChange({ ...layout, zones: newZones })
  }

  function handleUpdate(zone: ZoneName, idx: number, el: ZoneElement) {
    const newZones = {
      header: [...layout.zones.header],
      body: [...layout.zones.body],
      footer: [...layout.zones.footer],
    }
    newZones[zone] = newZones[zone].map((e, i) => (i === idx ? el : e))
    onLayoutChange({ ...layout, zones: newZones })
  }

  function handleDelete(zone: ZoneName, idx: number) {
    const newZones = {
      header: [...layout.zones.header],
      body: [...layout.zones.body],
      footer: [...layout.zones.footer],
    }
    newZones[zone] = newZones[zone].filter((_, i) => i !== idx)
    onLayoutChange({ ...layout, zones: newZones })
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {(["header", "body", "footer"] as const).map((zone) => (
          <ZoneSection
            key={zone}
            zoneName={zone}
            elements={layout.zones[zone]}
            onAdd={(type) => handleAdd(zone, type)}
            onUpdate={(idx, el) => handleUpdate(zone, idx, el)}
            onDelete={(idx) => handleDelete(zone, idx)}
          />
        ))}
      </div>
    </DragDropContext>
  )
}
