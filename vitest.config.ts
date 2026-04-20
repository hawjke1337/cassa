import { defineConfig } from "vitest/config"
import path from "path"

/**
 * Vitest config для ePRM.
 *
 * Структура `projects` разделяет unit и e2e тесты:
 * - `unit`: быстрые unit-тесты (money.ts, utils, валидаторы) — mock-friendly, без БД
 * - `e2e`: integration-тесты на реальном PostgreSQL (`astore_erp_test`),
 *          schema-per-worker изоляция через `src/__tests__/setup-db.ts`.
 *
 * Custom matcher `toEqualDecimal` загружается через `setupFiles` — доступен во всех тестах.
 *
 * Запуск:
 *   pnpm test:unit   — только unit (без БД)
 *   pnpm test:e2e    — только e2e (реальный PostgreSQL)
 *   pnpm test        — всё
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "prisma/__tests__/**/*.test.ts"],
          exclude: [
            "src/**/*.e2e.test.ts",
            "src/__tests__/e2e/**",
            "src/__tests__/e2e-real-db.test.ts",
          ],
          setupFiles: ["./src/__tests__/setup-decimal-matcher.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          include: ["src/__tests__/e2e/**/*.e2e.test.ts"],
          pool: "forks",
          setupFiles: ["./src/__tests__/setup-decimal-matcher.ts", "./src/__tests__/setup-db.ts"],
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
