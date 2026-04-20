"use client"

import { toast } from "sonner"

/**
 * useCriticalToast — helper для отображения критичных ошибок
 * (продажа, оплата, возврат, закрытие смены) с retry-кнопкой.
 *
 * UX2-05: Критичные операции показывают toast с кнопкой "Повторить",
 * вызывающей переданный callback. Duration 10s — оператор должен
 * успеть отреагировать.
 *
 * Использование:
 * ```ts
 * const criticalToast = useCriticalToast()
 * try {
 *   await createSale(...)
 * } catch (err) {
 *   criticalToast.error("Ошибка оплаты", {
 *     description: err instanceof Error ? err.message : undefined,
 *     retry: handleSubmit,
 *   })
 * }
 * ```
 */
export function useCriticalToast() {
  return {
    error(title: string, opts: { description?: string; retry: () => void | Promise<void> }) {
      toast.error(title, {
        description: opts.description,
        action: {
          label: "Повторить",
          onClick: () => {
            void opts.retry()
          },
        },
        duration: 10000,
      })
    },
  }
}
