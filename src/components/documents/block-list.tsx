"use client"

import { useState } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { GripVertical, Trash2, Plus, ChevronDown, ChevronRight, Type, Heading, List, Table, PenLine, Minus, Image, Space, PanelTop } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BlockSettings } from "@/components/documents/block-settings/index"
import type { DocumentBlock, DocumentType, BlockType } from "@/lib/validations/document-templates"
import { BLOCK_TYPES, BLOCK_TYPE_LABELS } from "@/lib/validations/document-templates"

interface BlockListProps {
  blocks: DocumentBlock[]
  documentType: DocumentType
  onChange: (blocks: DocumentBlock[]) => void
  excludeTypes?: BlockType[]
}

const BLOCK_ICONS: Record<BlockType, React.ReactNode> = {
  text: <Type className="size-4" />,
  heading: <Heading className="size-4" />,
  keyValue: <List className="size-4" />,
  table: <Table className="size-4" />,
  signatures: <PenLine className="size-4" />,
  divider: <Minus className="size-4" />,
  image: <Image className="size-4" />,
  spacer: <Space className="size-4" />,
  panel: <PanelTop className="size-4" />,
}

function createDefaultBlock(type: BlockType): DocumentBlock {
  const id = crypto.randomUUID()
  switch (type) {
    case "text":
      return { id, type: "text", content: "", fontSize: 14, fontWeight: "normal", textAlign: "left" }
    case "heading":
      return { id, type: "heading", content: "", fontSize: 18, fontWeight: "bold", textAlign: "center" }
    case "keyValue":
      return { id, type: "keyValue", items: [], layout: "stacked", fontSize: 14 }
    case "table":
      return { id, type: "table", columns: [], showRowNumbers: true, showTotal: true, totalLabel: "Итого:", fontSize: 12 }
    case "signatures":
      return { id, type: "signatures", items: [], showDate: true }
    case "divider":
      return { id, type: "divider", style: "solid", margin: 8 }
    case "image":
      return { id, type: "image", src: "", maxHeight: 100, align: "center" }
    case "spacer":
      return { id, type: "spacer", height: 20 }
    case "panel":
      return { id, type: "panel", border: true, padding: 8, children: [] }
  }
}

export function BlockList({ blocks, documentType, onChange, excludeTypes = [] }: BlockListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const availableTypes = BLOCK_TYPES.filter((t) => !excludeTypes.includes(t))

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDragEnd(result: DropResult) {
    const { source, destination } = result
    if (!destination || destination.index === source.index) return
    const next = [...blocks]
    const [moved] = next.splice(source.index, 1)
    next.splice(destination.index, 0, moved)
    onChange(next)
  }

  function handleAdd(type: BlockType) {
    const block = createDefaultBlock(type)
    onChange([...blocks, block])
    setExpandedIds((prev) => new Set([...prev, block.id]))
  }

  function handleDelete(id: string) {
    onChange(blocks.filter((b) => b.id !== id))
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function handleBlockChange(updated: DocumentBlock) {
    onChange(blocks.map((b) => (b.id === updated.id ? updated : b)))
  }

  return (
    <div className="space-y-2">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="block-list">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 min-h-[40px]">
              {blocks.map((block, idx) => {
                const isExpanded = expandedIds.has(block.id)
                return (
                  <Draggable key={block.id} draggableId={block.id} index={idx}>
                    {(dragProvided) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className="border rounded-md bg-card"
                      >
                        <div className="flex items-center gap-2 px-2 py-2">
                          <div
                            {...dragProvided.dragHandleProps}
                            className="cursor-grab text-muted-foreground shrink-0"
                          >
                            <GripVertical className="size-4" />
                          </div>
                          <span className="text-muted-foreground shrink-0">
                            {BLOCK_ICONS[block.type]}
                          </span>
                          <span className="flex-1 text-sm font-medium truncate">
                            {BLOCK_TYPE_LABELS[block.type]}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            onClick={() => toggleExpand(block.id)}
                          >
                            {isExpanded
                              ? <ChevronDown className="size-4" />
                              : <ChevronRight className="size-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(block.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-3 border-t pt-3">
                            <BlockSettings
                              block={block}
                              documentType={documentType}
                              onChange={handleBlockChange}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="w-full gap-2">
              <Plus className="size-4" />
              Добавить блок
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-48">
          {availableTypes.map((type) => (
            <DropdownMenuItem key={type} onClick={() => handleAdd(type)} className="gap-2">
              {BLOCK_ICONS[type]}
              {BLOCK_TYPE_LABELS[type]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
