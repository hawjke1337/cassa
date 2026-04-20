/**
 * Нормализация телефона в формат +7XXXXXXXXXX (Россия).
 * Принимает: 89001234567, +79001234567, 8(900)123-45-67, 9001234567
 * Возвращает: +79001234567
 * Если невалидный — возвращает null.
 */
export function normalizePhone(raw: string): string | null {
  // Strip all non-digit characters
  const digits = raw.replace(/\D/g, "")

  // Handle Russian phone formats
  if (digits.length === 11 && digits.startsWith("8")) {
    return "+7" + digits.slice(1)
  }
  if (digits.length === 11 && digits.startsWith("7")) {
    return "+" + digits
  }
  if (digits.length === 10) {
    // Assume Russian mobile without prefix
    return "+7" + digits
  }

  return null
}

/**
 * Проверка валидности телефона (после нормализации).
 */
export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) !== null
}

/**
 * Нормализация с выбросом ошибки для server actions.
 */
export function normalizePhoneOrThrow(raw: string, fieldName = "phone"): string {
  const normalized = normalizePhone(raw)
  if (!normalized) {
    throw new Error(`Невалидный номер телефона в поле "${fieldName}": ${raw}`)
  }
  return normalized
}
