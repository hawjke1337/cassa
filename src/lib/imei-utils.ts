export function isValidImei(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(imei[i], 10)
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/**
 * Валидация IMEI с выбросом ошибки для server actions.
 * Очищает пробелы и проверяет формат + Luhn.
 */
export function validateImeiOrThrow(imei: string, fieldName = "IMEI"): string {
  const cleaned = imei.replace(/\s/g, "")
  if (!isValidImei(cleaned)) {
    throw new Error(
      `Невалидный ${fieldName}: ${imei}. IMEI должен содержать 15 цифр и пройти проверку Luhn.`,
    )
  }
  return cleaned
}

/**
 * INV-06: Валидация серийного идентификатора с учётом типа категории.
 *
 * - IMEI:  15 цифр + Luhn algorithm (строгая валидация для телефонов)
 * - SN:    любая непустая строка (серийный номер аксессуара, не IMEI)
 * - BOTH:  любая непустая строка (dual-SIM: оба поля могут быть IMEI или SN)
 *
 * Use this вместо validateImeiOrThrow когда категория может иметь identifierType != IMEI.
 */
export function validateSerialOrThrow(
  value: string,
  identifierType: "IMEI" | "SN" | "BOTH",
  fieldName = "Серийный номер",
): string {
  const cleaned = value.replace(/\s/g, "")
  if (!cleaned) {
    throw new Error(`${fieldName}: значение не может быть пустым`)
  }
  if (identifierType === "IMEI") {
    if (!isValidImei(cleaned)) {
      throw new Error(
        `Невалидный ${fieldName}: ${value}. IMEI должен содержать 15 цифр и пройти проверку Luhn.`,
      )
    }
  }
  // SN and BOTH: accept any non-empty string
  return cleaned
}
