const loginAttempts = new Map<
  string,
  { count: number; firstAttempt: number; lockedUntil: number | null }
>()

const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const WINDOW_MS = 15 * 60 * 1000

export function checkRateLimit(username: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now()
  const entry = loginAttempts.get(username)

  if (entry?.lockedUntil && now < entry.lockedUntil) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - now }
  }

  if (entry?.lockedUntil && now >= entry.lockedUntil) {
    loginAttempts.delete(username)
    return { allowed: true }
  }

  if (entry && now - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(username)
  }

  return { allowed: true }
}

export function recordFailedAttempt(username: string): void {
  const now = Date.now()
  const entry = loginAttempts.get(username) ?? { count: 0, firstAttempt: now, lockedUntil: null }
  entry.count++
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCK_DURATION_MS
  }
  loginAttempts.set(username, entry)
}

export function clearAttempts(username: string): void {
  loginAttempts.delete(username)
}

// Cleanup stale entries every 30 minutes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, entry] of loginAttempts) {
        if (entry.lockedUntil && now >= entry.lockedUntil) {
          loginAttempts.delete(key)
        } else if (now - entry.firstAttempt > WINDOW_MS) {
          loginAttempts.delete(key)
        }
      }
    },
    30 * 60 * 1000,
  )
}

// =============================================
// Write Rate Limiting (SEC2-06)
// =============================================

const writeAttempts = new Map<string, { count: number; windowStart: number }>()

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const WRITE_RATE_LIMITS: Record<string, RateLimitConfig> = {
  "pos.sell": { maxRequests: 30, windowMs: 60_000 },
  "pos.return": { maxRequests: 10, windowMs: 60_000 },
  "inventory.receive": { maxRequests: 20, windowMs: 60_000 },
  "orders.create": { maxRequests: 15, windowMs: 60_000 },
  "cash.operation": { maxRequests: 10, windowMs: 60_000 },
  "settings.roles": { maxRequests: 10, windowMs: 60_000 },
  default: { maxRequests: 20, windowMs: 60_000 },
}

export function checkWriteRateLimit(
  userId: string,
  action: string,
): { allowed: boolean; retryAfterMs?: number } {
  const config = WRITE_RATE_LIMITS[action] ?? WRITE_RATE_LIMITS["default"]
  const key = `${userId}:${action}`
  const now = Date.now()
  const entry = writeAttempts.get(key)

  if (!entry || now - entry.windowStart > config.windowMs) {
    return { allowed: true }
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, retryAfterMs: config.windowMs - (now - entry.windowStart) }
  }

  return { allowed: true }
}

export function recordWriteAttempt(userId: string, action: string): void {
  const config = WRITE_RATE_LIMITS[action] ?? WRITE_RATE_LIMITS["default"]
  const key = `${userId}:${action}`
  const now = Date.now()
  const entry = writeAttempts.get(key)

  if (!entry || now - entry.windowStart > config.windowMs) {
    writeAttempts.set(key, { count: 1, windowStart: now })
  } else {
    entry.count++
  }
}

// Cleanup stale write entries every 30 minutes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, entry] of writeAttempts) {
        if (now - entry.windowStart > 300_000) {
          writeAttempts.delete(key)
        }
      }
    },
    30 * 60 * 1000,
  )
}
