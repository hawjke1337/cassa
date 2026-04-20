# CI и Branch Protection — Настройка main

## Что уже настроено автоматически

- Workflow `.github/workflows/ci.yml` запускается на каждый push в `main` и каждый PR в `main`
- 3 параллельных job: `Lint & Typecheck`, `Unit Tests`, `E2E Tests`
- PostgreSQL 17 service container (`postgres:17-alpine`) для E2E job
- Concurrency cancellation: новый push отменяет старые runs на тот же ref

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

После настройки попытка merge PR с красным CI должна быть заблокирована кнопкой «Merging is blocked».

Чтобы проверить работу правила:

1. Создать ветку `test/ci-verification`
2. Внести заведомо ломающее изменение (например, синтаксическая ошибка в любом `.ts` файле)
3. Открыть PR в `main`
4. Убедиться что хотя бы один из 3 required checks красный
5. Кнопка `Merge pull request` должна быть заблокирована
6. Удалить тестовую ветку после проверки

## Что НЕ настраивается на этапе Phase 7

- **Coverage threshold** — отложено до команды > 3 человек (нет смысла при одном разработчике)
- **Required signed commits** — отложено до production-релиза
- **Linear history requirement** — отложено, пока используем squash merge стратегию
- **CODEOWNERS required reviews** — будет добавлено когда появятся команды

## Troubleshooting

- **E2E job падает с «connection refused»** — postgres health check ещё не прошёл, увеличить `--health-retries` в `.github/workflows/ci.yml` (сейчас 10)
- **`prisma migrate deploy` зависает** — проверить что `DATABASE_URL` указывает на `localhost:5432`, а не на DNS имя (CI runner не резолвит имена service containers извне job network)
- **`schema test_w0 already exists`** — предыдущий run не очистил, добавить `DROP SCHEMA IF EXISTS "test_w0" CASCADE` в `setup-db.ts` `beforeAll`
- **`pnpm install --frozen-lockfile` падает** — `pnpm-lock.yaml` устарел относительно `package.json`, запустить локально `pnpm install` и закоммитить обновлённый lockfile
- **E2E тесты проходят локально, но падают в CI** — проверить что `prisma db push` (локально) и `prisma migrate deploy` (в CI) применяют одинаковую схему; см. заметку в `07-01-SUMMARY.md` про расхождение миграций
