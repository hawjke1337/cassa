"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BlockList } from "@/components/documents/block-list"
import { DocumentRenderer } from "@/components/documents/document-renderer"
import { updateDocumentTemplate } from "@/actions/document-templates"
import { DOCUMENT_TYPE_LABELS } from "@/lib/validations/document-templates"
import type {
  DocumentLayout,
  DocumentType,
} from "@/lib/validations/document-templates"
import { DEMO_DATA } from "@/lib/document-variables"
import { toast } from "sonner"

interface TemplateData {
  id: string
  storeId: string
  storeName: string
  name: string
  type: string
  layout: unknown
  isDefault: boolean
  createdAt: string
}

interface EditorClientProps {
  template: TemplateData
}

export function EditorClient({ template }: EditorClientProps) {
  const documentType = template.type as DocumentType
  const [name, setName] = useState(template.name)
  const [layout, setLayout] = useState<DocumentLayout>(
    template.layout as unknown as DocumentLayout
  )
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const demoData = DEMO_DATA[documentType]

  async function handleSave() {
    startTransition(async () => {
      try {
        await updateDocumentTemplate(template.id, { name, layout })
        toast.success("Шаблон сохранён")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка сохранения")
      }
    })
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Left panel */}
      <div className="w-[40%] flex flex-col gap-4 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/settings/document-templates")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Badge variant="secondary">{DOCUMENT_TYPE_LABELS[documentType]}</Badge>
          <Button onClick={handleSave} disabled={isPending}>
            <Save className="size-4" />
            Сохранить
          </Button>
        </div>

        {/* Block list */}
        <BlockList
          blocks={layout.blocks}
          documentType={documentType}
          onChange={(blocks) => setLayout((prev) => ({ ...prev, blocks }))}
        />

        {/* Global settings */}
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Настройки страницы</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Отступы (мм)</Label>
              <Input
                type="number"
                value={layout.pageMargin}
                onChange={(e) =>
                  setLayout((prev) => ({
                    ...prev,
                    pageMargin: Number(e.target.value),
                  }))
                }
                min={0}
                max={50}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Шрифт</Label>
              <Select
                value={layout.fontFamily}
                onValueChange={(v) =>
                  setLayout((prev) => ({
                    ...prev,
                    fontFamily: v as "serif" | "sans-serif",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="serif">Serif</SelectItem>
                  <SelectItem value="sans-serif">Sans-serif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - preview */}
      <div className="w-[60%] overflow-y-auto rounded-lg border bg-gray-100 p-4">
        <div
          className="mx-auto bg-white shadow-lg"
          style={{ width: "210mm", maxWidth: "100%" }}
        >
          <DocumentRenderer
            layout={layout}
            data={demoData.data}
            items={demoData.items}
            documentType={documentType}
            preview
          />
        </div>
      </div>
    </div>
  )
}
