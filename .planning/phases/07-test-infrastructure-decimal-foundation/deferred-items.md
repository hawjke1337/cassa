# Deferred Items — Phase 07

Items discovered during execution but out of scope for the current task.

## Pre-existing typecheck errors (discovered in 07-01)

**File:** `src/__tests__/confirm-receive-integration.test.ts`
**Count:** 4 errors (lines 100, 171, 230, 238)
**Error:** `TS2339: Property 'mockResolvedValue' does not exist on type ...`
**Cause:** Prisma 7 client types no longer allow `.mockResolvedValue()` on strongly-typed model methods. Pre-existing — not caused by 07-01 changes.
**Why deferred:** CONTEXT.md §"Cleanup" says `confirm-receive-integration.test.ts` should be migrated to the new E2E pattern in a later task. 07-01 only creates the infrastructure; migration of existing mocked tests is out of scope.
**Action:** Migrate to `src/__tests__/e2e/confirm-receive.e2e.test.ts` in phase 07 plan 07-05 (documentation & migration) or first relevant feature phase.

## Money-guard violations outside hotspot scope (discovered in 07-03)

**Task:** 07-03 hotspot migration установил ESLint правило `no-restricted-syntax` запрещающее `Number()` на денежных полях. Правило scoped только к 5 hotspot-файлам в 07-03; остальные файлы с money-field Number() calls остаются на будущее.

**Files pending money-migration (58 violations across 13 files):**

- `src/actions/cash-operations.ts`
- `src/actions/catalog.ts`
- `src/actions/dashboard.ts`
- `src/actions/document-templates.ts`
- `src/actions/inventory.ts`
- `src/actions/motivation-payroll.ts`
- `src/actions/price-labels.ts`
- `src/actions/reports.ts`
- `src/actions/serial-units.ts`
- `src/actions/suppliers.ts`
- `src/actions/trade-in.ts`
- `src/app/(dashboard)/print/shift/[id]/page.tsx`
- `src/components/pos/payment-dialog.tsx`
- `src/components/repairs/repair-form.tsx` (form input parsing)

**Why deferred:** 07-03 scope — "5 hotspot-файлов" (sales, shifts, orders, motivation-calculation, repairs). Расширение scope на эти файлы = 11+ дополнительных миграций, каждая требует отдельной проверки бизнес-логики и E2E тестов. План phase 15 (Data Integrity Hardening) включает полную Decimal-миграцию оставшихся файлов.

**Action:** Запланировать plan в Phase 15 (DATA2) — "Full Decimal Migration Sweep". После миграции — расширить ESLint rule scope на `src/actions/**` и затем на `src/**/*.{ts,tsx}`.

## 07-04 Task 3: GitHub branch protection setup (deferred by user)

**Task:** 07-04-PLAN.md Task 3 — Пользователь настраивает Branch Protection Rules в GitHub UI.
**Reason:** Проект не подтверждён как опубликованный на GitHub. Пользователь явно отложил настройку branch protection на будущее.
**Current state:** CI workflow `.github/workflows/ci.yml` создан и готов (commits 2bd4f4f, 077fb70). Документация `docs/CI-BRANCH-PROTECTION.md` готова с пошаговой инструкцией. Автоматическое блокирование merge при красном CI (enforcement gate) НЕ активировано.
**Action:** Когда проект будет опубликован на GitHub, следовать инструкции в `docs/CI-BRANCH-PROTECTION.md` — открыть Settings → Branches → Add branch protection rule → включить required status checks: `Lint & Typecheck`, `Unit Tests`, `E2E Tests`.
**Requirement:** TEST2-03 — частично выполнено (CI pipeline создан, enforcement gate отложен).

## Pre-existing lint errors (not caused by 07-03)

**Count:** 102 problems (69 errors, 33 warnings) pre-existing в кодовой базе ДО 07-03.
**Типы:** `@typescript-eslint/no-explicit-any`, `react-hooks/set-state-in-effect`, `react-hooks/refs`, `@typescript-eslint/no-unused-vars`.
**Verified:** `git stash` + `npm run lint` показывает те же 102 проблемы — не связаны с миграцией sales/shifts/orders/motivation/repairs.
**Why deferred:** 07-03 scope boundary — fix только issues caused by current task's changes. Pre-existing issues → future cleanup plan.
