"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface PermissionMatrixProps {
  modules: {
    module: string
    moduleName: string
    permissions: { id: string; code: string; name: string }[]
  }[]
  selectedCodes: string[]
  onChange: (codes: string[]) => void
  disabled?: boolean
}

export function PermissionMatrix({
  modules,
  selectedCodes,
  onChange,
  disabled = false,
}: PermissionMatrixProps) {
  function togglePermission(code: string) {
    if (disabled) return
    if (selectedCodes.includes(code)) {
      onChange(selectedCodes.filter((c) => c !== code))
    } else {
      onChange([...selectedCodes, code])
    }
  }

  function toggleModule(moduleCodes: string[]) {
    if (disabled) return
    const allSelected = moduleCodes.every((c) => selectedCodes.includes(c))
    if (allSelected) {
      onChange(selectedCodes.filter((c) => !moduleCodes.includes(c)))
    } else {
      const newCodes = new Set([...selectedCodes, ...moduleCodes])
      onChange(Array.from(newCodes))
    }
  }

  return (
    <div className="space-y-4">
      {modules.map((mod) => {
        const moduleCodes = mod.permissions.map((p) => p.code)
        const allSelected =
          moduleCodes.length > 0 && moduleCodes.every((c) => selectedCodes.includes(c))
        const someSelected = !allSelected && moduleCodes.some((c) => selectedCodes.includes(c))

        return (
          <div key={mod.module} className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">{mod.moduleName}</span>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id={`module-all-${mod.module}`}
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={() => toggleModule(moduleCodes)}
                  disabled={disabled}
                />
                <Label
                  htmlFor={`module-all-${mod.module}`}
                  className="cursor-pointer text-xs text-muted-foreground"
                >
                  Все
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {mod.permissions.map((perm) => (
                <div key={perm.code} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`perm-${perm.code}`}
                    checked={selectedCodes.includes(perm.code)}
                    onCheckedChange={() => togglePermission(perm.code)}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor={`perm-${perm.code}`}
                    className="cursor-pointer text-xs font-normal leading-tight"
                  >
                    {perm.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
