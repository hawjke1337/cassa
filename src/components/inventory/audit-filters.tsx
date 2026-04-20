"use client"

/**
 * INV-08: Audit page filter controls.
 * Toggle "В т.ч. удалённые" shows soft-deleted StoreProduct rows.
 *
 * Consumed by audit-detail-client.tsx and audit-list-client.tsx.
 */

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export interface AuditFiltersProps {
  showDeleted: boolean
  onShowDeletedChange: (next: boolean) => void
}

export function AuditFilters({ showDeleted, onShowDeletedChange }: AuditFiltersProps) {
  return (
    <div className="flex items-center gap-2 py-2">
      <Checkbox
        id="audit-show-deleted"
        checked={showDeleted}
        onCheckedChange={(val) => onShowDeletedChange(Boolean(val))}
      />
      <Label htmlFor="audit-show-deleted" className="cursor-pointer text-sm">
        В т.ч. удалённые
      </Label>
    </div>
  )
}
