"use client"

import { toast } from "sonner"
import { useCallback, useRef } from "react"

/**
 * Extracts retryAfterMs from rate limit error messages.
 * Server actions throw errors like: "Слишком много запросов. Повторите через 45 сек."
 */
export function parseRateLimitError(error: unknown): number | null {
  if (!(error instanceof Error)) return null
  const match = error.message.match(/Повторите через (\d+) сек/)
  if (!match) return null
  return parseInt(match[1], 10) * 1000
}

/**
 * Hook that wraps server action calls to display rate limit toast with countdown.
 *
 * Usage:
 * ```tsx
 * const { withRateLimitToast } = useRateLimitToast()
 * const handleSave = () => withRateLimitToast(() => createSale(data))
 * ```
 */
export function useRateLimitToast() {
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const showCountdownToast = useCallback((retryAfterMs: number) => {
    let remaining = Math.ceil(retryAfterMs / 1000)
    toast.error(`Слишком много запросов. Подождите ${remaining} сек.`, {
      duration: retryAfterMs + 1000,
      id: "rate-limit-countdown",
    })

    // Clear any existing countdown
    if (countdownRef.current) clearInterval(countdownRef.current)

    countdownRef.current = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current)
        toast.success("Можно продолжать", { id: "rate-limit-countdown", duration: 2000 })
        return
      }
      toast.error(`Слишком много запросов. Подождите ${remaining} сек.`, {
        id: "rate-limit-countdown",
        duration: remaining * 1000 + 1000,
      })
    }, 1000)
  }, [])

  const withRateLimitToast = useCallback(
    async <T>(action: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await action()
      } catch (error) {
        const retryAfterMs = parseRateLimitError(error)
        if (retryAfterMs !== null) {
          showCountdownToast(retryAfterMs)
          return undefined
        }
        throw error // Re-throw non-rate-limit errors
      }
    },
    [showCountdownToast],
  )

  return { withRateLimitToast, showCountdownToast }
}
