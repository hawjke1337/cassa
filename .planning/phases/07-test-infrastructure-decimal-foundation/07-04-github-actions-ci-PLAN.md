---
phase: 07-test-infrastructure-decimal-foundation
plan: 04
type: execute
wave: 2
depends_on: ["07-01"]
files_modified:
  - .github/workflows/ci.yml
  - docs/CI-BRANCH-PROTECTION.md
autonomous: false
requirements: [TEST2-03]
must_haves:
  truths:
    - "На каждый push в любую ветку GitHub Actions запускает 3 параллельных job: lint, unit, e2e"
    - "E2E job поднимает postgres:17-alpine service container, выполняет migrate deploy, прогоняет vitest e2e project"
    - "Красный билд на любом из 3 jobs блокирует merge в main (через branch protection)"
    - "Concurrency cancels stale runs на тот же ref"
  artifacts:
    - path: .github/workflows/ci.yml
      provides: "3-job CI pipeline (lint, unit, e2e) with Postgres service"
      contains: "postgres:17-alpine"
    - path: docs/CI-BRANCH-PROTECTION.md
      provides: "Инструкция по настройке branch protection (требует ручной шаг в GitHub UI)"
  key_links:
    - from: .github/workflows/ci.yml
      to: package.json scripts
      via: "pnpm test:unit, pnpm test:e2e, pnpm lint, pnpm typecheck"
      pattern: "pnpm test:e2e"
    - from: .github/workflows/ci.yml
      to: postgres service container
      via: "services.postgres"
      pattern: "services:"
---

<objective>
Создать GitHub Actions CI pipeline с 3 параллельными jobs (lint, unit, e2e), запускающимися на каждый push. Postgres 17 service container обеспечивает реальную БД для e2e job. Branch protection на main блокирует merge при красном билде.

Purpose: V1.0 интеграционные баги пропускались потому что не было автоматического CI. Каждый PR должен прогонять полный test suite на реальной БД до merge.
Output: `.github/workflows/ci.yml` + документация по настройке branch protection.
</objective>

<execution_context>
@/Users/pushkarev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pushkarev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-test-infrastructure-decimal-foundation/07-CONTEXT.md
@package.json
@vitest.config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Создать .github/workflows/ci.yml</name>
  <files>.github/workflows/ci.yml</files>
  <read_first>
    - package.json (сверить scripts: lint, typecheck, test:unit, test:e2e — должны быть из Plan 01)
    - .planning/phases/07-test-infrastructure-decimal-foundation/07-CONTEXT.md (lines 100-145, "CI pipeline" section — версии actions, postgres image)
    - prisma/schema.prisma (для понимания миграций)
  </read_first>
  <action>
    Создать `.github/workflows/ci.yml` с тремя параллельными jobs. Использовать ТОЧНО эти версии actions:

    ```yaml
    name: CI

    on:
      push:
        branches: [main]
      pull_request:
        branches: [main]

    concurrency:
      group: ci-${{ github.ref }}
      cancel-in-progress: true

    jobs:
      lint:
        name: Lint & Typecheck
        runs-on: ubuntu-24.04
        steps:
          - uses: actions/checkout@v5
          - uses: pnpm/action-setup@v4
            with:
              version: 9
          - uses: actions/setup-node@v5
            with:
              node-version: 20
              cache: 'pnpm'
          - run: pnpm install --frozen-lockfile
          - run: pnpm prisma generate
          - run: pnpm lint
          - run: pnpm typecheck

      unit:
        name: Unit Tests
        runs-on: ubuntu-24.04
        steps:
          - uses: actions/checkout@v5
          - uses: pnpm/action-setup@v4
            with:
              version: 9
          - uses: actions/setup-node@v5
            with:
              node-version: 20
              cache: 'pnpm'
          - run: pnpm install --frozen-lockfile
          - run: pnpm prisma generate
          - run: pnpm test:unit

      e2e:
        name: E2E Tests
        runs-on: ubuntu-24.04
        services:
          postgres:
            image: postgres:17-alpine
            env:
              POSTGRES_DB: astore_erp_test
              POSTGRES_USER: astore
              POSTGRES_PASSWORD: astore_ci
            ports:
              - 5432:5432
            options: >-
              --health-cmd "pg_isready -U astore -d astore_erp_test"
              --health-interval 5s
              --health-timeout 5s
              --health-retries 10
        env:
          DATABASE_URL_TEST: postgresql://astore:astore_ci@localhost:5432/astore_erp_test
          DATABASE_URL: postgresql://astore:astore_ci@localhost:5432/astore_erp_test
        steps:
          - uses: actions/checkout@v5
          - uses: pnpm/action-setup@v4
            with:
              version: 9
          - uses: actions/setup-node@v5
            with:
              node-version: 20
              cache: 'pnpm'
          - run: pnpm install --frozen-lockfile
          - run: pnpm prisma generate
          - run: pnpm prisma migrate deploy
          - name: Run E2E tests
            run: pnpm vitest run --project e2e
            env:
              DATABASE_URL_TEST: postgresql://astore:astore_ci@localhost:5432/astore_erp_test
    ```

    Примечания:
    - НЕ использовать `actions/cache` для node_modules — pnpm cache из setup-node достаточно
    - НЕ использовать `dotenv -e .env.test` в CI — переменные из `env:` блока workflow
    - `prisma migrate deploy` запускается ОДИН раз против БД, дальше vitest worker создаёт schema_w0, w1 поверх
    - Если seed нужен — добавить `pnpm prisma db seed` перед `vitest run`

  </action>
  <verify>
    <automated>cd astore-erp && test -f .github/workflows/ci.yml && grep -q "postgres:17-alpine" .github/workflows/ci.yml && grep -q "services:" .github/workflows/ci.yml && grep -q "pnpm test:unit" .github/workflows/ci.yml && grep -q "vitest run --project e2e" .github/workflows/ci.yml && grep -q "concurrency:" .github/workflows/ci.yml</automated>
  </verify>
  <acceptance_criteria>
    - `.github/workflows/ci.yml` exists
    - Contains literal `postgres:17-alpine`
    - Contains literal `services:` and `cancel-in-progress: true`
    - Contains 3 job names: `lint`, `unit`, `e2e`
    - E2E job contains literal `prisma migrate deploy`
    - E2E job has `DATABASE_URL_TEST` env var
    - Uses `actions/checkout@v5`, `actions/setup-node@v5`, `pnpm/action-setup@v4`
    - `runs-on: ubuntu-24.04` (НЕ `latest`)
    - YAML валидный: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0
  </acceptance_criteria>
  <done>
    CI workflow создан, валидный YAML, использует правильные версии actions, постгрес service настроен.
  </done>
</task>

<task type="auto">
  <name>Task 2: Создать docs/CI-BRANCH-PROTECTION.md</name>
  <files>docs/CI-BRANCH-PROTECTION.md</files>
  <read_first>
    - .github/workflows/ci.yml (Task 1 result)
    - .planning/phases/07-test-infrastructure-decimal-foundation/07-CONTEXT.md (Branch protection section)
  </read_first>
  <action>
    Создать `docs/CI-BRANCH-PROTECTION.md` с инструкцией для пользователя (на русском, как все правила проекта):

    ```markdown
    # CI и Branch Protection — Настройка main

    ## Что уже настроено автоматически

    - Workflow `.github/workflows/ci.yml` запускается на каждый push в main и каждый PR в main
    - 3 параллельных job: `Lint & Typecheck`, `Unit Tests`, `E2E Tests`
    - PostgreSQL 17 service container для E2E job
    - Concurrency cancellation: новый push отменяет старые runs

    ## Что нужно настроить вручную в GitHub UI

    Branch protection не может быть настроен из workflow. После первого push с CI:

    1. Открыть **Settings → Branches** в репозитории
    2. Нажать **Add branch protection rule**
    3. Branch name pattern: `main`
    4. Включить:
       - [x] **Require a pull request before merging**
         - [x] Require approvals: 1
         - [x] Dismiss stale pull request approvals when new commits are pushed
       - [x] **Require status checks to pass before merging**
         - [x] Require branches to be up to date before merging
         - Status checks (добавить ВСЕ ТРИ):
           - `Lint & Typecheck`
           - `Unit Tests`
           - `E2E Tests`
       - [x] **Require conversation resolution before merging**
       - [x] **Do not allow bypassing the above settings** (или allow только для admins)
    5. Сохранить

    ## Проверка

    После настройки попытка merge PR с красным CI должна быть заблокирована кнопкой "Merging is blocked".

    ## Не настраивается на этапе Phase 7

    - Coverage threshold — отложено до команды > 3 человек
    - Required signed commits
    - Linear history requirement

    ## Troubleshooting

    - **E2E падает с "connection refused"** — postgres health check ещё не прошёл, увеличить `--health-retries`
    - **prisma migrate deploy зависает** — проверить что DATABASE_URL указывает на localhost:5432, а не на CI runner DNS
    - **schema test_w0 already exists** — предыдущий run не очистил, добавить `DROP SCHEMA IF EXISTS` в setup-db.ts beforeAll
    ```

  </action>
  <verify>
    <automated>cd astore-erp && test -f docs/CI-BRANCH-PROTECTION.md && grep -q "Branch Protection" docs/CI-BRANCH-PROTECTION.md && grep -q "Lint & Typecheck" docs/CI-BRANCH-PROTECTION.md && grep -q "E2E Tests" docs/CI-BRANCH-PROTECTION.md</automated>
  </verify>
  <acceptance_criteria>
    - `docs/CI-BRANCH-PROTECTION.md` exists
    - Contains literal strings: `Branch Protection`, `Lint & Typecheck`, `Unit Tests`, `E2E Tests`, `Settings → Branches`
    - Contains step-by-step нумерованную инструкцию (lines с `1.`, `2.`, `3.`)
    - Документация на русском языке
  </acceptance_criteria>
  <done>
    Документация по branch protection готова, пользователь может настроить за < 5 минут.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Пользователь настраивает Branch Protection в GitHub UI</name>
  <what-built>
    - `.github/workflows/ci.yml` — 3-job pipeline с Postgres service
    - `docs/CI-BRANCH-PROTECTION.md` — инструкция
  </what-built>
  <how-to-verify>
    1. Сделать `git add .github/workflows/ci.yml docs/CI-BRANCH-PROTECTION.md && git commit && git push` (или включить в общий PR Phase 7)
    2. Открыть GitHub Actions tab — убедиться что workflow запустился
    3. Все 3 job (Lint, Unit, E2E) должны быть зелёными (или красными если в коде есть проблемы — тогда исправить и продолжить)
    4. Открыть **Settings → Branches → Add rule** для `main`
    5. Следовать инструкции в `docs/CI-BRANCH-PROTECTION.md` (раздел "Что нужно настроить вручную")
    6. Создать тестовый PR — убедиться что merge заблокирован пока CI не пройдёт
  </how-to-verify>
  <resume-signal>Введите "approved" когда branch protection настроен и тестовый PR показывает требование зелёного CI, или опишите проблемы.</resume-signal>
</task>

</tasks>

<verification>
1. Workflow YAML валиден
2. После push CI запустился и видно 3 jobs в Actions tab
3. Branch protection rule создан на `main` с 3 required checks
4. Тестовый PR с красным CI блокируется от merge
</verification>

<success_criteria>

- CI прогоняет lint + unit + e2e на каждый push
- Postgres 17 service работает
- Branch protection требует все 3 checks для merge в main
  </success_criteria>

<output>
Создать `.planning/phases/07-test-infrastructure-decimal-foundation/07-04-SUMMARY.md`.
</output>
</content>
</invoke>
