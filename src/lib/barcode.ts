export function isValidEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false

  let sum = 0
  for (let i = 0; i < 13; i++) {
    const digit = parseInt(code[i], 10)
    sum += i % 2 === 0 ? digit : digit * 3
  }

  return sum % 10 === 0
}
