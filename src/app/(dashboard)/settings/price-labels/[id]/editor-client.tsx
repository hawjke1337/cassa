"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { getTemplate, updateTemplate } from "@/actions/price-labels"
import { PriceLabelRenderer } from "@/components/price-labels/label-renderer"
import { LabelSettingsPanel } from "@/components/price-labels/label-settings-panel"
import { ZoneEditor } from "@/components/price-labels/zone-editor"
import type { PriceLabelLayout } from "@/lib/validations/price-labels"
import { DEFAULT_LAYOUT } from "@/components/price-labels/label-constants"

interface EditorClientProps {
  templateId: string
}

export function EditorClient({ templateId }: EditorClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [name, setName] = useState("")
  const [layout, setLayout] = useState<PriceLabelLayout>(DEFAULT_LAYOUT)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const template = await getTemplate(templateId)
        setName(template.name)
        setLayout(template.layout as unknown as PriceLabelLayout)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка загрузки")
        router.push("/settings/price-labels")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [templateId, router])

  function handleLayoutChange(newLayout: PriceLabelLayout) {
    setLayout(newLayout)
    setHasChanges(true)
  }

  function handleNameChange(newName: string) {
    setName(newName)
    setHasChanges(true)
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateTemplate(templateId, { name, layout })
        toast.success("Шаблон сохранён")
        setHasChanges(false)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка сохранения")
      }
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-[250px_1fr_300px] gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/settings/price-labels")}>
            <ArrowLeft className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold">{name || "Новый шаблон"}</h2>
        </div>
        <Button onClick={handleSave} disabled={isPending || !hasChanges}>
          <Save className="size-4" />
          Сохранить
        </Button>
      </div>

      <div className="grid grid-cols-[250px_1fr_300px] gap-6">
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Настройки</h3>
          <LabelSettingsPanel
            name={name}
            onNameChange={handleNameChange}
            layout={layout}
            onLayoutChange={handleLayoutChange}
          />
        </div>

        <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-8">
          <PriceLabelRenderer layout={layout} scale={2} />
        </div>

        <div className="space-y-4 overflow-y-auto rounded-lg border p-4" style={{ maxHeight: "calc(100vh - 160px)" }}>
          <h3 className="text-sm font-semibold">Элементы</h3>
          <ZoneEditor layout={layout} onLayoutChange={handleLayoutChange} />
        </div>
      </div>
    </div>
  )
}
