import { cn } from "@/lib/utils"

/**
 * UX2-07: Inline form validation helpers.
 *
 * Возвращают Tailwind-классы для полей с ошибкой — красная рамка + ring.
 * Используется с react-hook-form / Zod formik-подобными формами:
 * `<Input className={fieldErrorClass(errors.amount)} />`.
 *
 * Helper text: `<p className={helperTextClass(!!errors.amount)}>...</p>`.
 */
export function fieldErrorClass(hasError: boolean | unknown | undefined): string {
  return cn(Boolean(hasError) && "border-destructive focus-visible:ring-destructive")
}

export function helperTextClass(hasError: boolean | unknown | undefined): string {
  return cn(Boolean(hasError) ? "text-destructive" : "text-muted-foreground", "text-xs")
}
