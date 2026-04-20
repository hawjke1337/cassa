# Phase 1: Безопасность - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Закрыть все дыры в безопасности server actions: валидация цен/количеств из БД (не от клиента), JWT invalidation при смене ролей, store-scoped permissions на все trade-in/reports/shifts actions, rate limiting на логин, усиление паролей. Чисто серверные изменения — UI не затрагивается (кроме минимальных изменений для отображения ошибок).

</domain>

<decisions>
## Implementation Decisions

### Валидация цен POS
- Сервер ВСЕГДА берёт sellPrice и costPrice из StoreProduct по productId+storeId
- Клиент передаёт только: productId, quantity, discount, serialUnitId (для серийных)
- Скидка (discount) разрешена любому продавцу, но ограничена: >= 0 и <= sellPrice
- Скидка свыше определённого порога (например, > 30%) требует permission `pos.discount_high`
- quantity валидируется: > 0, целое число, <= остаток на складе

### JWT и permissions
- Короткий maxAge для JWT: 15 минут
- При каждом jwt callback — перезагрузка permissions из БД (не кэш из первого логина)
- При деактивации пользователя (toggleUserActive) — немедленная инвалидация (версия permissions в БД, сравнение с JWT)
- Компромисс: +1 запрос к БД на каждый authenticated request, но permissions всегда актуальны

### Rate limiting на логин
- Блокировка по username (не по IP — NAT может блокировать весь офис)
- 5 неудачных попыток → блокировка на 15 минут
- Хранение счётчика в памяти (Map) — при рестарте сервера сбрасывается (приемлемо для внутреннего инструмента)
- Не использовать Redis (избыточно для POS-системы с ~10 пользователями)

### Пароли
- Минимум 8 символов (вместо текущих 4)
- Без требований к спецсимволам (внутренний инструмент, не публичный сервис)
- Миграция: существующие пароли < 8 символов продолжают работать, но при смене — новые требования

### writeSerialHistory
- Вынести в отдельный файл `src/lib/serial-history.ts` (без "use server")
- Импортировать в server actions как internal helper

### Продажа без смены
- Запретить создание продажи если нет открытой смены для текущего storeId
- Вернуть понятную ошибку: "Откройте кассовую смену перед продажей"

### Claude's Discretion
- Конкретная реализация rate limiting middleware
- Структура ошибок (формат сообщений)
- Порядок проверок внутри server actions (auth → permission → validation → business logic)

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above and in REQUIREMENTS.md (SEC-01..06, AUTH-01..04, PERM-01..05).

### Ключевые файлы для изменения
- `src/actions/sales.ts` — валидация цен POS (SEC-01..06)
- `src/actions/trade-in.ts` — storeId в permissions (PERM-01)
- `src/actions/reports.ts` — storeId в permissions (PERM-02)
- `src/actions/motivation-payroll.ts` — разделение permissions (PERM-03)
- `src/actions/document-templates.ts` → `getDocumentData` — permission check (PERM-04)
- `src/actions/shifts.ts` — store-scoped permissions (PERM-05)
- `src/actions/serial-units.ts` — вынос writeSerialHistory (AUTH-04)
- `src/lib/auth.ts` + `src/lib/auth.config.ts` — JWT refresh, maxAge (AUTH-01)
- `src/lib/permissions.ts` — потенциальная оптимизация (кэш per-request)
- `src/actions/settings.ts` — минимальная длина пароля (AUTH-03)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requirePermission(code, storeId?)` в `src/lib/permissions.ts` — уже поддерживает storeId, просто не все actions его передают
- `auth()` из NextAuth — возвращает session с user.id
- Zod-схемы в `src/lib/validations/` — можно расширить для серверной валидации цен

### Established Patterns
- Каждый server action: `await requirePermission(...)` первой строкой → сохраняем этот паттерн
- Prisma transactions `db.$transaction()` → используем для атомарных операций
- Toast для ошибок на клиенте → server actions возвращают `{ success: false, error: string }`

### Integration Points
- `createSale` в sales.ts — основная точка для валидации цен (строки 125-230)
- `createReturn` в sales.ts — проверка storeId (строки 538-663)
- `authorize` callback в auth.ts — точка для JWT refresh logic
- Login page (`src/app/(auth)/login/page.tsx`) — rate limiting middleware перед authorize

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-security*
*Context gathered: 2026-04-05*
