/**
 * Timezone utilities for MSK (UTC+3).
 * Все магазины в одном часовом поясе — Москва.
 * БД хранит timestamps в UTC.
 * При фильтрации по дате: конвертируем MSK boundaries в UTC.
 *
 * MSK = UTC+3 (фиксированный, без DST с 2014 года).
 * Не используем Intl.DateTimeFormat или timezone-библиотеки —
 * для фиксированного offset они избыточны.
 */

const MSK_OFFSET_HOURS = 3

/**
 * Начало дня по MSK в UTC.
 * Например, 14 апреля 00:00 MSK = 13 апреля 21:00 UTC
 */
export function mskStartOfDay(date: Date): Date {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  return new Date(Date.UTC(year, month, day, 0 - MSK_OFFSET_HOURS, 0, 0, 0))
}

/**
 * Конец дня по MSK в UTC.
 * Например, 14 апреля 23:59:59.999 MSK = 14 апреля 20:59:59.999 UTC
 */
export function mskEndOfDay(date: Date): Date {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  return new Date(Date.UTC(year, month, day, 23 - MSK_OFFSET_HOURS, 59, 59, 999))
}

/**
 * Конвертирует пару дат (dateFrom, dateTo) в UTC range по MSK.
 * Используется для Prisma where: { createdAt: { gte, lte } }
 */
export function toMskDateRange(dateFrom: Date, dateTo: Date): { gte: Date; lte: Date } {
  return {
    gte: mskStartOfDay(dateFrom),
    lte: mskEndOfDay(dateTo),
  }
}

/**
 * Текущий момент "сегодня" по MSK — start и end в UTC.
 * Используется для dashboard "продажи за сегодня".
 */
export function mskToday(): { gte: Date; lte: Date } {
  const now = new Date()
  // Определяем текущую дату по MSK
  const mskNow = new Date(now.getTime() + MSK_OFFSET_HOURS * 60 * 60 * 1000)
  const mskDate = new Date(mskNow.getUTCFullYear(), mskNow.getUTCMonth(), mskNow.getUTCDate())
  return toMskDateRange(mskDate, mskDate)
}
