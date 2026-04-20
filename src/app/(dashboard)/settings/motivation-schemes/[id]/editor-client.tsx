"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CommissionRulesEditor } from "@/components/motivation/commission-rules-editor"
import { CrossSellEditor } from "@/components/motivation/cross-sell-editor"
import { AssignmentManager } from "@/components/motivation/assignment-manager"
import { updateMotivationScheme } from "@/actions/motivation-schemes"
import { toast } from "sonner"
import type {
  MotivationFormula,
  CommissionRule,
  CrossSellBonus,
} from "@/lib/validations/motivation"

type SchemeStatus = "ACTIVE" | "PENDING_APPROVAL" | "ARCHIVED"

type Assignment = {
  id: string
  userId: string
  userName: string
  storeId: string
  storeName: string
  startDate: string
  endDate: string | null
}

type MotivationGroup = {
  id: string
  code: string
  name: string
  description: string | null
  productCount: number
  createdAt: string
}

type Scheme = {
  id: string
  name: string
  description: string | null
  formula: MotivationFormula
  status: SchemeStatus
  storeId: string | null
  storeName: string
  createdByName: string
  approvedByName: string | null
  approvedAt: string | null
  version: number
  assignments: Assignment[]
  createdAt: string
}

interface EditorClientProps {
  scheme: Scheme
  groups: MotivationGroup[]
}

const STATUS_LABELS: Record<SchemeStatus, string> = {
  ACTIVE: "Активна",
  PENDING_APPROVAL: "Ожидает подтверждения",
  ARCHIVED: "В архиве",
}

const STATUS_BADGE_CLASSES: Record<SchemeStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  ARCHIVED: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
}

export function EditorClient({ scheme, groups }: EditorClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isArchived = scheme.status === "ARCHIVED"

  const [name, setName] = useState(scheme.name)
  const [formula, setFormula] = useState<MotivationFormula>(scheme.formula)

  function updateDailyRate(value: number) {
    setFormula((prev) => ({ ...prev, dailyRate: value }))
  }

  function updateRepairBonus(value: number) {
    setFormula((prev) => ({ ...prev, repairBonus: value }))
  }

  function updateCommission(rules: CommissionRule[], defaultCommission: CommissionRule) {
    setFormula((prev) => ({ ...prev, commissionRules: rules, defaultCommission }))
  }

  function updateCrossSell(bonuses: CrossSellBonus[]) {
    setFormula((prev) => ({ ...prev, crossSellBonuses: bonuses }))
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error("Укажите название схемы")
      return
    }

    startTransition(async () => {
      try {
        const result = await updateMotivationScheme(
          scheme.id,
          {
            name: name.trim(),
            description: scheme.description,
            storeId: scheme.storeId,
            formula,
          },
          scheme.version,
        )
        const res = result as { id: string; pendingApproval?: boolean }
        if (res.pendingApproval) {
          toast.success("Изменения отправлены на подтверждение")
        } else {
          toast.success("Схема сохранена")
        }
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push("/settings/motivation-schemes")}
            >
              <ArrowLeft className="size-4" />
              <span className="sr-only">Назад</span>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{scheme.name}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[scheme.status]}`}
            >
              {STATUS_LABELS[scheme.status]}
            </span>
          </div>
          <div className="flex items-center gap-3 pl-9">
            <span className="text-sm text-muted-foreground">{scheme.storeName}</span>
            <span className="text-sm text-muted-foreground">Создал: {scheme.createdByName}</span>
            {scheme.approvedByName && (
              <span className="text-sm text-muted-foreground">
                Подтвердил: {scheme.approvedByName}
              </span>
            )}
          </div>
        </div>
      </div>

      {isArchived && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-amber-400">
          Схема находится в архиве — редактирование недоступно.
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="formula">
        <TabsList>
          <TabsTrigger value="formula">Формула</TabsTrigger>
          <TabsTrigger value="assignments">Назначения</TabsTrigger>
        </TabsList>

        <TabsContent value="formula" className="mt-6 space-y-8">
          {/* Name */}
          <div className="grid gap-2 max-w-sm">
            <Label htmlFor="scheme-name">Название схемы</Label>
            <Input
              id="scheme-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isArchived}
            />
          </div>

          {/* Daily rate */}
          <div className="grid gap-2 max-w-xs">
            <Label htmlFor="daily-rate">Дневная ставка, ₽ (за смену)</Label>
            <Input
              id="daily-rate"
              type="number"
              min={0}
              step={100}
              value={formula.dailyRate}
              onChange={(e) => updateDailyRate(parseFloat(e.target.value) || 0)}
              disabled={isArchived}
            />
          </div>

          {/* Commission rules */}
          <CommissionRulesEditor
            rules={formula.commissionRules}
            defaultCommission={formula.defaultCommission}
            groups={groups}
            onChange={updateCommission}
            disabled={isArchived}
          />

          {/* Cross-sell bonuses */}
          <CrossSellEditor
            bonuses={formula.crossSellBonuses}
            onChange={updateCrossSell}
            disabled={isArchived}
          />

          {/* Repair bonus */}
          <div className="grid gap-2 max-w-xs">
            <Label htmlFor="repair-bonus">Бонус за ремонт, ₽ (за единицу)</Label>
            <Input
              id="repair-bonus"
              type="number"
              min={0}
              step={50}
              value={formula.repairBonus}
              onChange={(e) => updateRepairBonus(parseFloat(e.target.value) || 0)}
              disabled={isArchived}
            />
          </div>

          {/* Save button */}
          {!isArchived && (
            <div className="flex">
              <Button onClick={handleSave} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Сохранить
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="mt-6">
          <AssignmentManager schemeId={scheme.id} assignments={scheme.assignments} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
