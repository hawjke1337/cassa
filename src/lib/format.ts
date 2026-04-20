export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}м`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}
