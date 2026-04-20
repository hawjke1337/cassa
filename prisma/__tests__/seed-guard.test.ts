/**
 * Seed-guard unit test (BUILD-02).
 *
 * Проверяет защиту prisma/seed.ts от случайного запуска в production:
 *   - NODE_ENV=production БЕЗ SEED_ALLOW_PROD=true → exit 1 + stderr "Refusing"
 *   - NODE_ENV=production + SEED_ALLOW_PROD=true → guard пропускает
 *   - NODE_ENV=test/development → guard пропускает
 *
 * Реализация через spawnSync: запускаем реальный seed.ts с подменённым env
 * и флагом --dry-run, чтобы seed вышел сразу после guard без подключения к БД.
 *
 * TDD lifecycle:
 *   - Задача 1: RED — guard ещё не реализован, first test FAIL
 *   - Задача 2: GREEN — guard добавлен в prisma/seed.ts, все тесты PASS
 */
import { describe, it, expect } from "vitest"
import { spawnSync } from "node:child_process"
import path from "node:path"

const SEED_SCRIPT = path.resolve(__dirname, "../seed.ts")

/**
 * Копия process.env с явно очищенными ключами (спец-значение "" удаляется в runSeed).
 */
function buildEnv(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key]
    } else {
      env[key] = value
    }
  }
  return env
}

function runSeed(envOverrides: Record<string, string | undefined>, extraArgs: string[] = []) {
  return spawnSync("npx", ["tsx", SEED_SCRIPT, ...extraArgs], {
    env: buildEnv(envOverrides),
    encoding: "utf-8",
    timeout: 30_000,
  })
}

describe("seed-guard (BUILD-02)", () => {
  it("exits with code 1 in production without SEED_ALLOW_PROD", () => {
    const result = runSeed({ NODE_ENV: "production", SEED_ALLOW_PROD: undefined })

    expect(result.status).toBe(1)
    // Русская или английская формулировка допустимы; ключевое слово — Refusing / Отказ
    expect(`${result.stderr}${result.stdout}`).toMatch(/Refusing|Отказ/)
  })

  it("passes guard in production WITH SEED_ALLOW_PROD=true (--dry-run)", () => {
    const result = runSeed({ NODE_ENV: "production", SEED_ALLOW_PROD: "true" }, ["--dry-run"])

    // Guard не должен печатать "Refusing"
    expect(`${result.stderr}${result.stdout}`).not.toMatch(/Refusing/)
    // dry-run завершается exit 0 (guard пропустил, до БД не дошли)
    expect(result.status).toBe(0)
  })

  it("passes guard in non-production environments (NODE_ENV=test)", () => {
    const result = runSeed({ NODE_ENV: "test", SEED_ALLOW_PROD: undefined }, ["--dry-run"])

    expect(`${result.stderr}${result.stdout}`).not.toMatch(/Refusing/)
    expect(result.status).toBe(0)
  })

  it("passes guard in development environment", () => {
    const result = runSeed({ NODE_ENV: "development", SEED_ALLOW_PROD: undefined }, ["--dry-run"])

    expect(`${result.stderr}${result.stdout}`).not.toMatch(/Refusing/)
    expect(result.status).toBe(0)
  })
})
