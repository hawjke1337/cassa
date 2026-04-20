# Roadmap: ePRM — Стабилизация POS-системы a:store

## Overview

Существующая POS-система работает, но аудит выявил 21 критичную и 37 высоких/средних проблем. Бизнес теряет деньги из-за дыр в безопасности (клиент передает цены), race conditions на остатках и неверного расчета маржи. Дорожная карта идет от самого опасного (безопасность) к наименее срочному (UX), затем добавляет единственный новый функционал (заказы/поставщики) и укрепляет инфраструктуру. 58 требований, 6 фаз, ноль новых фич до закрытия блокеров.

После завершения v1.0 (6 фаз, 17 планов, 144+ тестов) проведено ручное QA + 5-агентный аудит — найдено 100 багов. Запущен milestone v1.1 — Financial Integrity & Security: 110 требований, 10 фаз (Phase 7-16), обязательные E2E тесты на реальной БД в каждой фазе.

После завершения v1.1 (2026-04-18) проведён post-v1.1 audit — найдены 7 production-readiness блокеров (typecheck errors, отсутствие TLS/backup/observability). Запущен milestone v1.2 — Production Hardening: 17 требований, 3 фазы (Phase 17-19). Цель: безопасный деплой на VPS, готовый к реальной эксплуатации.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)
- Phases 1-6 — milestone v1.0 (completed)
- Phases 7-16 — milestone v1.1 (Financial Integrity & Security)
- Phases 17-19 — milestone v1.2 (Production Hardening)

### v1.0 Milestone (completed)

- [x] **Phase 1: Безопасность** - Закрыть все дыры: валидация цен, permissions, auth hardening
- [x] **Phase 2: Целостность данных** - Гарантия корректности остатков, нумерации, расчетов (completed 2026-04-05)
- [x] **Phase 3: Схема БД** - Индексы, FK-правила, constraints, soft delete, timestamps
- [x] **Phase 4: Заказы и поставщики** - Полный цикл заказа с закупочной ценой, долгами и прибылью (completed 2026-04-05)
- [x] **Phase 5: Инфраструктура** - Тесты, error boundaries, SQL-отчеты, Docker, CI tooling
- [x] **Phase 6: UX** - POS-удобство, дашборд, навигация, мелкие улучшения

### v1.1 Milestone — Financial Integrity & Security

- [x] **Phase 7: Test Infrastructure & Decimal Foundation** - E2E на реальной БД, фикстуры, CI; миграция денег на Decimal.js (completed 2026-04-08)
- [x] **Phase 8: Order/Sale Flow & Предоплаты** - Корректное завершение/отмена заказа, частичный возврат, синхронизация статусов (completed 2026-04-09, conditional sign-off Option A)
- [x] **Phase 9: Race Conditions & Locking** - SELECT FOR UPDATE на SerialUnit, StoreProduct, transfer reservation (completed 2026-04-09)
- [x] **Phase 10: Reports Correctness & Banking Fees** - Фильтр COMPLETED, returns в report, кассовый отчёт, обратный процент комиссий (completed 2026-04-09)
- [x] **Phase 11: Repair as Sale** - Ремонт → Sale при DELIVERED, COGS запчастей, гарантия по проданным IMEI (completed 2026-04-11)
- [x] **Phase 12: Security Fixes & Roles UI** - IDOR getSale/reports, soft delete bypass, AuditLog, страница ролей (completed 2026-04-12)
- [x] **Phase 13: Suppliers & Debts** - Долг от purchasePrice, оплата через CashOperation, сводка долгов, дашборд (completed 2026-04-13)
- [x] **Phase 14: Payroll & Employee Dashboard** - Per-item commission fix, личный кабинет ЗП с расшифровкой по сменам (co-seller отложен)
- [x] **Phase 15: Data Integrity Hardening** - Payment CHECK, varchar limits, UTC timezone, IMEI/phone normalization, optimistic locking (completed 2026-04-14)
- [x] **Phase 16: Inventory Edge Cases & UX Polish** - Audit cleanup, transfer locking, category change guards, накопленный UX долг (completed 2026-04-14)

### v1.2 Milestone — Production Hardening

- [x] **Phase 17: Build & Seed Safety** - Чистый typecheck (0 ошибок), seed с prod-guard, clean build без warnings (completed 2026-04-20)
- [ ] **Phase 18: Secure Deploy Foundation** - docker-compose.prod + caddy TLS + автобэкапы + secrets template + secure cookies + rate limit
- [ ] **Phase 19: Observability & Runtime Hardening** - Sentry + pino + /api/health + /api/metrics + CSP + raw SQL audit + connection pooling

## Phase Details

### Phase 1: Безопасность

**Goal**: Ни одна операция в системе не может быть выполнена с подменёнными данными, без нужных прав или в обход контроля доступа
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, AUTH-01, AUTH-02, AUTH-03, AUTH-04, PERM-01, PERM-02, PERM-03, PERM-04, PERM-05
**Success Criteria** (what must be TRUE):

1. Продавец не может изменить цену продажи или себестоимость через DevTools или подмену запроса — сервер всегда берет цены из БД
2. После того как администратор снимает роль у пользователя, тот при следующем запросе теряет соответствующие permissions (без ручного перелогина)
3. Продавец магазина А не может провести trade-in, посмотреть отчеты или закрыть смену магазина Б — каждый action проверяет storeId
4. После 5 неудачных попыток логина аккаунт временно блокируется; пароль короче 8 символов отклоняется при создании/смене
5. Продажа без открытой кассовой смены невозможна — система требует открыть смену или показывает явное предупреждение
   **Plans**: 3 plans

Plans:

- [ ] 01-01: Серверная валидация цен и данных POS (SEC-01..06)
- [ ] 01-02: Auth hardening (AUTH-01..04)
- [ ] 01-03: Permissions и store-scoped access (PERM-01..05)

### Phase 2: Целостность данных

**Goal**: Все финансовые расчеты, остатки и нумерация корректны даже при конкурентном доступе
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-09, DATA-10
**Success Criteria** (what must be TRUE):

1. Два продавца одновременно продают последний экземпляр товара — один получает ошибку "нет в наличии", а не минусовой остаток
2. При приёмке 10 единиц по 100р к имеющимся 5 по 80р — costPrice становится ~93.33р (средневзвешенная), а не 100р
3. Отмена заказа полностью откатывает все побочные эффекты: платежи, серийники, долги поставщику
4. Частичный возврат 1 из 3 единиц корректно рассчитывает комиссию продавца за оставшиеся 2 единицы
5. Авто-закрытие смены показывает ожидаемую сумму наличных и расхождение (не null/пустые значения)
   **Plans**: 3 plans

Plans:

- [ ] 02-01-PLAN.md — Race conditions: SELECT FOR UPDATE и транзакционная нумерация (DATA-01, DATA-02)
- [ ] 02-02-PLAN.md — Финансовые расчеты: costPrice, комиссии, валидация (DATA-03, DATA-05, DATA-06, DATA-07)
- [ ] 02-03-PLAN.md — Бизнес-логика: отмена заказов, смены, trade-in (DATA-04, DATA-08, DATA-09, DATA-10)

### Phase 3: Схема БД

**Goal**: Схема базы данных гарантирует целостность на уровне СУБД и обеспечивает производительность запросов
**Depends on**: Phase 2
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07
**Success Criteria** (what must be TRUE):

1. Все часто используемые запросы (продажи по дате, товары по магазину, платежи по смене) используют индексы — нет Seq Scan на таблицах > 1000 строк
2. Удаление магазина или пользователя не оставляет висячих записей — FK onDelete правила определены на всех связях
3. Невозможно вставить price < 0, quantity < 0 или amount < 0 через любой путь (ORM, raw SQL, миграция) — CHECK constraints на уровне БД
4. Удалённые товары, поставщики, клиенты и пользователи помечаются deletedAt вместо физического удаления
5. Все таблицы с мутациями имеют updatedAt с автообновлением
   **Plans**: 3 plans

Plans:

- [ ] 03-01-PLAN.md — Индексы и уникальные constraints (DB-01, DB-07)
- [ ] 03-02-PLAN.md — FK onDelete, soft delete, updatedAt, PriceHistory FK (DB-02, DB-03, DB-04, DB-05)
- [ ] 03-03-PLAN.md — CHECK constraints (DB-06)

### Phase 4: Заказы и поставщики

**Goal**: Владелец видит реальную прибыль по каждому заказу и контролирует долги поставщикам
**Depends on**: Phase 2 (финансовые расчеты), Phase 3 (схема для новых таблиц)
**Requirements**: ORD-01, ORD-02, ORD-03, ORD-04, ORD-05, ORD-06, ORD-07, ORD-08
**Success Criteria** (what must be TRUE):

1. При создании заказа продавец выбирает поставщика из списка; после выдачи заказа менеджер вводит закупочную цену и стоимость доставки
2. В карточке заказа отображается чистая прибыль = цена продажи - закупочная цена - доставка
3. При подтверждении заказа система автоматически фиксирует долг поставщику; отчет по долгам показывает оплаченные и неоплаченные
4. Комиссия продавца от заказов рассчитывается от чистой прибыли, а не от цены продажи
5. При выдаче заказа можно применить скидку; при заказе товара из каталога можно изменить цену
   **Plans**: 2 plans

Plans:

- [ ] 04-01-PLAN.md — Schema, бизнес-логика и UI заказов (ORD-01, ORD-02, ORD-03, ORD-04, ORD-07, ORD-08)
- [ ] 04-02-PLAN.md — Отчет по долгам и комиссия от прибыли (ORD-05, ORD-06)

### Phase 5: Инфраструктура

**Goal**: Система имеет автоматические тесты, graceful error handling и production-ready деплой
**Depends on**: Phase 1, Phase 2 (тестируемая бизнес-логика)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08
**Success Criteria** (what must be TRUE):

1. Vitest покрывает критичную бизнес-логику (продажи, возвраты, остатки, мотивация) — тесты запускаются за < 30 секунд
2. Ошибка на любой странице показывает пользователю понятное сообщение (error.tsx), а не белый экран; загрузка показывает скелетон (loading.tsx)
3. Отчет по продажам за год загружается < 3 секунд (SQL-агрегация, а не загрузка всех строк в RAM)
4. Docker Compose запускает систему одной командой с автомиграцией, healthcheck и без хардкода паролей
5. git push запускает Prettier + ESLint через Husky — код не может попасть в репозиторий без форматирования
   **Plans**: 3 plans

Plans:

- [ ] 05-01: Vitest setup и тесты критичной логики (INFRA-01)
- [ ] 05-02: Error/loading boundaries и revalidation (INFRA-02, INFRA-03, INFRA-08)
- [ ] 05-03: SQL-отчеты, Docker, security headers, CI tooling (INFRA-04, INFRA-05, INFRA-06, INFRA-07)

### Phase 6: UX

**Goal**: Продавец работает в POS быстро и без раздражающих мелочей; владелец видит ключевые метрики на дашборде
**Depends on**: Phase 2 (корректные данные для отображения), Phase 4 (прибыль для дашборда)
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12, UX-13, UX-14, UX-15
**Success Criteria** (what must be TRUE):

1. Поиск в POS не лагает при быстром вводе (debounce); товар добавляется в корзину по штрихкоду EAN-13 автоматически
2. Корзина POS сохраняется при случайном закрытии вкладки или обновлении страницы
3. В чеке и в БД фиксируется полученная сумма наличных и сдача; двойной клик на "Подтвердить оплату" не создает дубль
4. Дашборд показывает прибыль/маржу, количество готовых ремонтов, время смены в формате "Xч Yм"
5. Все маршруты имеют breadcrumbs; ошибки загрузки дашборда показываются через toast; нативные select заменены на shadcn
   **Plans**: 3 plans

Plans:

- [ ] 06-01: POS UX — debounce, корзина, штрихкод, escape fix (UX-01, UX-02, UX-04, UX-05)
- [ ] 06-02: POS оплата и продажи — сдача, двойной клик, комментарий, возврат, история (UX-03, UX-06, UX-07, UX-08, UX-09)
- [ ] 06-03: Дашборд и навигация (UX-10, UX-11, UX-12, UX-13, UX-14, UX-15)

---

## v1.1 — Financial Integrity & Security

### Phase 7: Test Infrastructure & Decimal Foundation

**Goal**: Каждая последующая фаза v1.1 пишет E2E тесты на реальной БД, а все денежные расчёты идут через Decimal.js без накопления float-погрешностей
**Depends on**: v1.0 завершён
**Requirements**: TEST2-01, TEST2-02, TEST2-03, DATA2-02
**Success Criteria** (what must be TRUE):

1. Разработчик запускает `pnpm test:e2e` — поднимается реальный PostgreSQL с фикстурами, прогоняются e2e-real-db тесты, БД очищается после
2. CI на каждый push прогоняет unit + E2E с PostgreSQL service в GitHub Actions; красный билд блокирует merge
3. Сложение 0.1 + 0.2 в любом денежном расчёте даёт ровно 0.30, а не 0.30000000000000004 — Decimal.js (или integer-копейки) применён везде
4. Существующие денежные поля (Sale, Payment, SupplierDebt, MotivationScheme) хранятся как Decimal в Prisma и не теряют точность на 1000 операций сложения/умножения
5. E2E тест-фреймворк документирован: новый разработчик создаёт тест на реальной БД за < 10 минут по шаблону
   **Plans**: 5 plans

Plans:

- [ ] 07-01-PLAN.md — E2E test infrastructure: vitest projects, schema-per-worker, fixtures (TEST2-01, TEST2-02)
- [ ] 07-02-PLAN.md — Decimal foundation: src/lib/money.ts + TDD precision tests + custom matcher (DATA2-02)
- [ ] 07-03-PLAN.md — Hotspot migration: sales/shifts/orders/motivation/repairs → Decimal + ESLint guard + E2E proof (DATA2-02)
- [ ] 07-04-PLAN.md — GitHub Actions CI: 3-job pipeline + Postgres 17 service + branch protection (TEST2-03)
- [ ] 07-05-PLAN.md — E2E framework documentation: docs/E2E-TESTING.md + template + < 10 min onboarding (TEST2-01, TEST2-02)

### Phase 8: Order/Sale Flow & Предоплаты

**Goal**: Завершение, отмена и частичный возврат заказа корректно учитывают предоплату, остатки и серийники — без потерь денег магазина
**Depends on**: Phase 7
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06, FIN-07, FIN-08, FIN-09, FIN-10, FIN-11, FIN-12
**Success Criteria** (what must be TRUE):

1. При завершении заказа с предоплатой 5000₽ и общей суммой 30000₽ — Sale.finalAmount = 25000₽, stock декрементится, серийники помечены SOLD
2. При отмене заказа оператор делает явный выбор "Удержать предоплату" (default) или "Вернуть клиенту"; "Вернуть" создаёт CashOperation изъятие + Payment isExpense=true
3. Частичный возврат 1 из 3 единиц рассчитывает refund по per-unit discount, а не делит total пополам
4. Невозможно создать оплату заказа без открытой смены (shiftId NOT NULL); переплата (totalPaid > totalAmount) блокируется
5. Return midway failure не оставляет Sale в COMPLETED — статус обновляется атомарно; refundMethod обязателен и валидируется от метода оригинального Payment
6. E2E тест на реальной БД покрывает: завершение заказа с предоплатой, отмену с возвратом, отмену с удержанием, частичный возврат, midway failure
   **Plans**: 6 plans

Plans:

- [x] 08-01-PLAN.md — Wave 0 RED: E2E stubs + fixtures + invariants helper + compute-per-unit-discount unit test + throwing stubs in orders.ts (все FIN-\*)
- [x] 08-02-PLAN.md — Wave 1: Schema migrations (Payment.shiftId, Return.refundMethod, CustomOrder.cancellationType, CustomOrder.cancelReason) + computePerUnitDiscount (FIN-06, FIN-08, FIN-09, FIN-11)
- [x] 08-03-PLAN.md — Wave 2 (parallel): completeOrder + addOrderPayment hardening + cancelOrderWithDecision + decrementStockForItems (FIN-01, 02, 03, 04, 05, 06, 08, 11, 12)
- [x] 08-04-PLAN.md — Wave 2 (parallel): createReturn hardening + CustomOrder sync + return-form refundMethod Select (FIN-07, 09, 10)
- [x] 08-05-PLAN.md — Wave 3: CancelDialog UI RadioGroup HOLD/REFUND + Visual QA (FIN-04)
- [x] 08-06-PLAN.md — Wave 4: Integration gate — full suite GREEN + invariants verification + VALIDATION sign-off (все 12 FIN-\*)

### Phase 9: Race Conditions & Locking

**Goal**: Конкурентные операции на остатках и серийных единицах не приводят к двойным продажам, отрицательным остаткам или orphaned записям
**Depends on**: Phase 7
**Requirements**: LOCK-01, LOCK-02, LOCK-03, LOCK-04, LOCK-05, LOCK-06
**Success Criteria** (what must be TRUE):

1. Два продавца одновременно сканируют один и тот же IMEI — один получает ошибку "уже продан", второй нет (FOR UPDATE на SerialUnit)
2. Два продавца одновременно продают последний несерийный товар — один получает ошибку "нет в наличии"; createSale декрементит stock атомарно
3. confirmTransferSent не позволяет продать товар в источнике после старта отправки (FOR UPDATE на StoreProduct источника)
4. Failure внутри SerialUnit-цикла confirmReceive откатывает StoreProduct — нет orphaned записей с qty без серийников
5. Stock Transfer резервирует stock в источнике с момента PENDING — пока перевод в обработке, эти единицы недоступны для продажи
6. E2E concurrency тест: 2 параллельных createSale на одну StoreProduct/SerialUnit — ровно один успех, один корректный отказ
   **Plans**: 3 plans

Plans:

- [ ] 09-01-PLAN.md — FOR UPDATE hardening: createSale (SerialUnit + batch stock) + createWriteOff (LOCK-01, LOCK-03, LOCK-05)
- [ ] 09-02-PLAN.md — Transfer reservation: schema reservedQuantity + confirmTransferSent FOR UPDATE + LOCK-04 atomicity (LOCK-02, LOCK-04, LOCK-06)
- [ ] 09-03-PLAN.md — E2E concurrency tests для всех 6 LOCK-_ + Phase 8 deferred hotfix (все LOCK-_)

### Phase 10: Reports Correctness & Banking Fees

**Goal**: Все отчёты и дашборд показывают финансовую правду — RETURNED исключены, returns вычитаются, банковские комиссии учтены через обратный процент
**Depends on**: Phase 8 (returns flow)
**Requirements**: REP-01, REP-02, REP-03, REP-04, REP-05, REP-06, REP-07, FEE-01, FEE-02, FEE-03, FEE-04, FEE-05
**Success Criteria** (what must be TRUE):

1. Отчёт по прибыли и продажам показывает только COMPLETED Sales; RETURNED и PARTIALLY_RETURNED исключены; returns вычитаются из revenue через JOIN
2. Отчёт по продавцу вычитает returns при расчёте выручки и комиссии; trade-in выплаты учтены как расход магазина
3. Кассовый отчёт за период показывает breakdown по методам оплаты (наличные / карта / СБП / перевод / кредит) и сверку с физической кассой
4. При оплате картой 100₽ с настроенной комиссией 2% — POS показывает "Цена 100 / Комиссия 2.04 / Итого к оплате 102.04" (обратный процент)
5. Дашборд показывает чистую прибыль (после банковских комиссий) и валовую отдельно; inventory report фильтрует deletedAt и isActive
6. E2E тест: отчёт по прибыли с миксом COMPLETED, RETURNED, PARTIALLY_RETURNED — суммы совпадают с ручным расчётом
   **Plans**: 4 plans

Plans:

- [ ] 10-01-PLAN.md — Schema (PaymentFeeConfig + Payment.feeAmount) + calcBankingFee + report backend fixes (REP-01..06, FEE-02, FEE-04, FEE-05)
- [ ] 10-02-PLAN.md — Cash report backend + UI: getCashReport + CashReport component (REP-07)
- [ ] 10-03-PLAN.md — Fee settings CRUD/UI + POS fee display + profit report/dashboard UI (FEE-01, FEE-03, FEE-04, FEE-05)
- [ ] 10-04-PLAN.md — E2E tests for all REP-01..07 + FEE-01..05 on real DB

### Phase 11: Repair as Sale

**Goal**: Ремонт при выдаче становится полноценной продажей — выручка видна в отчётах, запчасти списаны и учтены как COGS, гарантия работает по проданным IMEI
**Depends on**: Phase 7, Phase 10 (reports correctness)
**Requirements**: REPAIR-01, REPAIR-02, REPAIR-03, REPAIR-04, REPAIR-05, REPAIR-06, REPAIR-07, REPAIR-08, REPAIR-09
**Success Criteria** (what must be TRUE):

1. При переводе ремонта в DELIVERED создаётся Sale с finalCost как revenue; дашборд и отчёт по прибыли включают эту выручку
2. При использовании запчасти в ремонте StoreProduct.quantity декрементится; запчасти учитываются как COGS в profit report
3. Изменение estimatedCost / agreedCost / finalCost логируется в RepairCostHistory; после COMPLETED/DELIVERED менять цену запрещено
4. Гарантийное обращение находит проданный IMEI (фильтр SOLD+IN_STOCK), проверяет warrantyUntil, поиск работает по IMEI / номеру чека / номеру продажи
5. E2E тест: ремонт с запчастями → DELIVERED → проверка наличия Sale, декремента StoreProduct, COGS в отчёте
   **Plans**: 3 plans

Plans:

- [ ] 11-01-PLAN.md — Schema (RepairPart, RepairCostHistory, SaleType.REPAIR, Repair.saleId) + cost audit + cost freeze (REPAIR-05, REPAIR-06)
- [ ] 11-02-PLAN.md — DELIVERED->Sale conversion + spare parts + COGS + E2E tests (REPAIR-01, REPAIR-02, REPAIR-03, REPAIR-04)
- [ ] 11-03-PLAN.md — Warranty lookup fixes: SOLD+IN_STOCK filter + Sale.number search + E2E (REPAIR-07, REPAIR-08, REPAIR-09)

### Phase 12: Security Fixes & Roles UI

**Goal**: Закрыты IDOR, soft delete bypass, отсутствие AuditLog; администратор управляет ролями и правами через UI
**Depends on**: Phase 7
**Requirements**: SEC2-01, SEC2-02, SEC2-03, SEC2-04, SEC2-05, SEC2-06, SEC2-07, SEC2-08, SEC2-09, SEC2-10, ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05
**Success Criteria** (what must be TRUE):

1. Продавец магазина А не может получить getSale для продажи магазина Б по прямому ID; reports с reports.full проверяют доступ к storeId
2. db.ts $extends перехватывает findUnique для soft-deleted записей; невозможно получить deletedAt != null через прямой ID
3. createSale, createReceive, createOrder защищены rate limiting; updateUserRoles запрещает менять свою роль; closeShift с большим discrepancy требует подтверждения старшего
4. AuditLog таблица фиксирует все изменения ролей и привилегий; владелец видит структурированный лог
5. Администратор на /settings/roles создаёт роль, назначает permissions через матрицу чекбоксов, привязывает к пользователю; soft delete клиентов и магазинов через UI
6. E2E security тест: попытка IDOR getSale из чужого магазина → 403; попытка createSale без прав → 403; rate limiting срабатывает после N запросов
   **Plans**: 3 plans

Plans:

- [x] 12-01-PLAN.md — Security hardening: IDOR fixes, soft delete findUnique, rate limiting, business guards (SEC2-01..09) (completed 2026-04-12)
- [ ] 12-02-PLAN.md — AuditLog: Prisma model + createAuditEntry helper + /settings/audit-log UI page (SEC2-10)
- [ ] 12-03-PLAN.md — Roles CRUD UI с permission matrix + soft delete UI для клиентов/магазинов (ROLE-01..05)

### Phase 13: Suppliers & Debts

**Goal**: Долг поставщику считается от закупочной цены, оплачивается через кассу с явным учётом, владелец видит сводку и историю
**Depends on**: Phase 7, Phase 10
**Requirements**: SUP-01, SUP-02, SUP-03, SUP-04, SUP-05, SUP-06, SUP-07, SUP-08, SUP-09
**Success Criteria** (what must be TRUE):

1. SupplierDebt создаётся от costPrice*qty при ORDERED; purchasePrice вводится после COMPLETED и обновляет сумму долга (не блокирует ORDERED)
2. Карточка заказа показывает три суммы отдельно: Цена клиенту / Закуп / Прибыль (видны с orders.costs)
3. paySupplierDebt создаёт CashOperation(WITHDRAW, shiftId=null) + SupplierPayment, привязанные к SupplierDebt; частичная оплата; SupplierDebt.amount можно обновить
4. Страница /suppliers/debts показывает сводку всех долгов с фильтрами и итогами; в карточке поставщика — история платежей (SupplierPayment[])
5. Дашборд показывает карточку "Долги поставщикам: X ₽ (N неоплаченных)" (видна с orders.costs)
6. E2E тест: ORDERED без purchasePrice разрешён; оплата долга → CashOperation + SupplierPayment в БД; частичная оплата; отмена заказа с платежами
   **Plans**: 3 plans

Plans:

- [ ] 13-01-PLAN.md — Schema (SupplierPayment, CashOperation.shiftId nullable) + backend (paySupplierDebt, updateOrderCosts, audit) (SUP-01, SUP-02, SUP-04, SUP-05, SUP-06)
- [ ] 13-02-PLAN.md — UI: order card 3 amounts, DebtPaymentDialog, /suppliers/debts page, dashboard card, sidebar, payment history (SUP-03, SUP-04, SUP-07, SUP-08, SUP-09)
- [ ] 13-03-PLAN.md — E2E tests: payment+CashOp, partial payments, amount update, cancel with payments (SUP-01, SUP-02, SUP-05, SUP-06)

### Phase 14: Payroll & Employee Dashboard

**Goal**: Комиссия продавца считается корректно по позициям (per-item); сотрудник видит свою ЗП с расшифровкой по сменам. Co-seller отложен.
**Depends on**: Phase 7, Phase 8 (FIN per-unit), Phase 13 (purchase price)
**Requirements**: PAYROLL-01, PAYROLL-02, PAYROLL-03, PAYROLL-04, PAYROLL-05, PAYROLL-06
**Success Criteria** (what must be TRUE):

1. Order commission рассчитывается per-item (комиссия с каждой позиции отдельно), а не от total netProfit к каждой строке
2. PAYROLL-02 (co-seller) DEFERRED — не реализуется в этой фазе по решению пользователя
3. Сотрудник на /my/motivation видит свои продажи по магазинам и сменам с расшифровкой: товар, цена, прибыль, %, итоговая сумма комиссии
4. История начислений по месяцам в личном кабинете; сотрудник видит ТОЛЬКО свои данные (storeId scope)
5. E2E тест: per-item order commission корректен; продавец магазина А не видит данные продавца магазина Б через getMyPayrolls
   **Plans**: 3 plans

Plans:

- [x] 14-01-PLAN.md — Fix per-item order commission bug + E2E regression test (PAYROLL-01, PAYROLL-02 deferred)
- [x] 14-02-PLAN.md — Shift data in SaleCommission + getMyPayrolls server action + scope E2E (PAYROLL-03, PAYROLL-05, PAYROLL-06)
- [x] 14-03-PLAN.md — UI: shift-grouped EarningsBreakdown + PayrollHistory table + page integration (PAYROLL-03, PAYROLL-04)

### Phase 15: Data Integrity Hardening

**Goal**: На уровне БД и API закрыты последние дыры целостности — Payment exclusivity, varchar limits, UTC, IMEI/phone normalization, optimistic locking
**Depends on**: Phase 7
**Requirements**: DATA2-01, DATA2-03, DATA2-04, DATA2-05, DATA2-06, DATA2-07, DATA2-08, DATA2-09, DATA2-10, DATA2-11, DATA2-12
**Success Criteria** (what must be TRUE):

1. Payment имеет CHECK constraint: ровно один из (saleId, orderId, repairId) NOT NULL — невозможно создать orphan или multi-target Payment
2. Все денежные и текстовые поля имеют @db.VarChar(N) limits; quantity-поля имеют CHECK >= 0; SerialUnit @@unique([productId, imei]) when imei not null
3. Reports и dashboard используют UTC при date filtering — сутки начинаются в 00:00 UTC независимо от TZ сервера
4. IMEI валидируется во всех точках входа (receive, update, trade-in, import); normalizePhone() применяется в Customer/User/Store/Supplier create/update
5. MotivationScheme имеет version field для optimistic locking; UPDATE с устаревшей версией возвращает ошибку; формула валидируется на UPDATE и snapshot при применении
6. User cascade delete → SetNull для UserRole/UserStore (история сохраняется); DeviceRecord deduplication по IMEI при повторных ремонтах
7. E2E тест: попытка создать Payment с двумя FK → CHECK violation; concurrent UPDATE MotivationScheme → второй получает version conflict
   **Plans**: 5 plans

Plans:

- [ ] 15-01-PLAN.md — DB constraints: Payment exclusivity CHECK, quantity CHECKs, SerialUnit unique index + E2E (DATA2-01, DATA2-07, DATA2-09)
- [ ] 15-02-PLAN.md — Schema hardening: VarChar limits on all text fields + User cascade SetNull (DATA2-03, DATA2-06)
- [ ] 15-03-PLAN.md — Input normalization: normalizePhone() + IMEI validation at all entry points + E2E (DATA2-05, DATA2-08)
- [ ] 15-04-PLAN.md — MSK timezone handling for reports/dashboard date filtering (DATA2-04)
- [ ] 15-05-PLAN.md — Optimistic locking for MotivationScheme + formula validation + DeviceRecord dedup + E2E (DATA2-10, DATA2-11, DATA2-12)

### Phase 16: Inventory Edge Cases & UX Polish

**Goal**: Закрыты последние inventory edge cases (audit, transfer, category change, trade-in) и накопленный UX долг из QA
**Depends on**: Phase 9 (locking), Phase 13 (suppliers)
**Requirements**: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09, UX2-01, UX2-02, UX2-03, UX2-04, UX2-05, UX2-06, UX2-07, UX2-08, UX2-09, UX2-10, UX2-11, UX2-12, UX2-13, UX2-14, UX2-15, UX2-16, UX2-17
**Success Criteria** (what must be TRUE):

1. Изменение Category.isSerialized защищено guard (или migration tool); audit "MISSING" серийники переключаются в SerialUnit.status=MISSING/WRITTEN_OFF
2. Audit пересчитывает expected qty на момент закрытия (учитывая продажи в процессе); StoreProductHistory логирует изменения quantity (кто/когда/почему)
3. Receive создаёт StoreProduct с sellPrice = costPrice \* markup (не 0); Stock Transfer с null sourceSp валидируется; soft-deleted продукты видны в инвентаризации
4. createReturn требует AlertDialog подтверждения; PaymentDialog защищён от double-click через ref-lock; корзина блокируется пока открыт PaymentDialog
5. Чек продажи показывает IMEI для серийных, агрегирует платежи одного метода; бланк заказа печатает наименование товара; POS responsive на планшетах
6. POS показывает каталог категорий вместо пустого поиска; каталог и склад объединены в один раздел с кнопкой "Продать"; toast ошибок имеет "Повторить"
7. E2E тест: audit с продажами в процессе → корректный expected qty; double-click на оплату → один Sale; refresh во время оплаты → idempotency-key срабатывает
   **Plans**: 3 plans

Plans:

- [ ] 16-01-PLAN.md — Inventory edge cases: StoreProductHistory schema + closeAudit MISSING/WRITTEN_OFF + recomputed expectedQty + Category.isSerialized guard + Transfer validation + Receive sellPrice + Trade-in (INV-01..09)
- [ ] 16-02-PLAN.md — Payment & cart protection: PaymentDialog ref-lock + idempotency-key + cart blocking + Return/CloseShift AlertDialog + critical toast retry + inline validation (UX2-01..07, UX2-13)
- [ ] 16-03-PLAN.md — Receipts, print & POS layout: IMEI column + payment aggregation + PrintPreviewDialog + full order blank + POS responsive + CategoryGrid + ARIA + catalog/inventory merge (UX2-08..12, UX2-14..17)

---

## v1.2 — Production Hardening

**Milestone goal:** После v1.2 приложение безопасно деплоится на чистый VPS (Россия) одной командой с TLS, автобэкапами и мониторингом ошибок. Закрыты 7 production-readiness блокеров из post-v1.1 audit + security/observability улучшения.

**17 requirements across 3 phases** — compact milestone, no new business features.

### Phase 17: Build & Seed Safety

**Goal**: Кодовая база собирается чисто (0 typecheck errors, 0 build warnings), а `prisma/seed.ts` физически не может уничтожить production-данные случайной командой
**Depends on**: v1.1 завершён (все 16 фаз)
**Requirements**: BUILD-01, BUILD-02, BUILD-03
**Success Criteria** (what must be TRUE):

1. `pnpm typecheck` завершается exit code 0 — ноль TypeScript-ошибок (сейчас 35 в motivation-_, repairs.ts, trade-in.ts, test-файлах)
2. `pnpm build` завершается exit code 0 без warnings — production-bundle собирается чисто в `NODE_ENV=production`
3. `NODE_ENV=production pnpm prisma db seed` без флага `SEED_ALLOW_PROD=true` падает с явной ошибкой и ненулевым exit code — случайный seed в проде невозможен
4. `SEED_ALLOW_PROD=true pnpm prisma db seed` в prod-режиме создаёт ТОЛЬКО первого admin-пользователя с генерируемым паролем, который выводится в stdout (не залогирован в файл)

**Plans**: 3 plans

Plans:

- [ ] 17-01-PLAN.md — TypeScript Null Safety (BUILD-01): filter-null-on-input + ?? undefined + fixture drift + delete stale mocks
- [ ] 17-02-PLAN.md — Production-Safe Seed (BUILD-02): NODE_ENV guard + User.mustChangePassword migration + admin bootstrap (TDD)
- [ ] 17-03-PLAN.md — Clean Build + CI Gate (BUILD-03): pnpm build verification + husky pre-push hook + .env.production.example

### Phase 18: Secure Deploy Foundation

**Goal**: Оператор разворачивает ePRM на чистом VPS одной командой `docker-compose up -d` — с TLS, автопровизией сертификатов, закрытой от интернета БД, ежедневными бэкапами и полным набором документированных секретов
**Depends on**: Phase 17 (чистый build — предпосылка для prod-образа)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, SEC3-01, SEC3-02, SEC3-03
**Success Criteria** (what must be TRUE):

1. `docker-compose -f docker-compose.prod.yml up -d` на чистом VPS поднимает app + postgres + caddy; порт 5432 НЕ exposed в интернет (bind к internal network); все пароли читаются из `.env`, ни одного литерала в yaml
2. HTTPS сертификат от Let's Encrypt автоматически провизится и обновляется; HTTP→HTTPS redirect работает; заголовок `Strict-Transport-Security: max-age=...; includeSubDomains` присутствует в response
3. Ежедневный `pg_dump` запускается по cron в отдельном контейнере; retention 30 дней соблюдается (более старые файлы удаляются); `docs/DEPLOYMENT.md` содержит пошаговую команду `restore from backup`, которую разработчик успешно выполняет в staging
4. `.env.production.example` содержит ВСЕ необходимые переменные с комментариями: `DATABASE_URL`, `NEXTAUTH_SECRET` (с инструкцией `openssl rand -base64 32`), `NEXTAUTH_URL` (https://), `SENTRY_DSN`, `REDIS_URL` (optional), backup destinations; при запуске без одной из обязательных — приложение падает с понятной ошибкой
5. В prod-режиме NextAuth cookies имеют `secure: true`, `sameSite: 'strict'`, `httpOnly: true`; `NEXTAUTH_URL` валидируется на `https://` префикс при старте
6. Rate limiting либо переписан на Redis-backed (работает корректно через rolling restart), либо single-instance deploy constraint явно зафиксирован в `docker-compose.prod.yml` (replicas: 1) и задокументирован в `docs/DEPLOYMENT.md`

Plans: TBD (планирование через `/gsd:plan-phase 18`)

### Phase 19: Observability & Runtime Hardening

**Goal**: Любая ошибка в production приземляется в Sentry с контекстом и без PII; оператор видит здоровье системы через `/api/health` и метрики через `/api/metrics`; раскрытие кодовой базы минимизировано (CSP, raw SQL whitelist); БД не ложится под нагрузкой (connection pool)
**Depends on**: Phase 17 (чистый build), Phase 18 (защищённый deploy — prerequisite для Sentry SDK загрузки source maps и network isolation для /api/metrics)
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, SEC3-04, SEC3-05, PERF-01
**Success Criteria** (what must be TRUE):

1. Необработанное исключение в server action или API route через 5 секунд появляется в Sentry с source map stack trace; поле `email` / `password` отсутствует в breadcrumbs (PII scrubbing настроен); build загружает source maps в Sentry
2. `grep -rn "console\.\(log\|error\|warn\)" src/actions src/app/api | wc -l` возвращает 0 — все логи идут через pino; в prod формат JSON, level конфигурируется через env `LOG_LEVEL`
3. `GET /api/health` возвращает JSON с полями `{ db: 'ok'|'fail', redis: 'ok'|'fail'|'n/a', diskFreeGB: N }` — реально проверяет связность с БД и Redis, не просто 200 OK
4. `GET /api/metrics` возвращает Prometheus-формат с метриками: request count/duration/error rate, Prisma connection pool usage; endpoint доступен только изнутри docker network (не exposed через caddy public routes)
5. Заголовок `Content-Security-Policy` присутствует в каждом response; в report-only режиме до стабилизации, затем переключается в enforce; Tailwind inline styles разрешены явно (`style-src 'self' 'unsafe-inline'`)
6. В `src/actions/**/*.ts` каждый `$queryRawUnsafe` или `Prisma.raw` имеет комментарий `// SAFETY: whitelist | template literal | rationale`; PR-ревью отклоняет новые использования без комментария
7. PostgreSQL под нагрузкой 50 одновременных запросов не возвращает `too many connections` — либо PgBouncer (transaction mode) в docker-compose, либо `?connection_limit=10&pool_timeout=30` в `DATABASE_URL` с документацией тюнинга в `docs/DEPLOYMENT.md`

Plans: TBD (планирование через `/gsd:plan-phase 19`)

## Progress

**Execution Order:**
v1.0: Phases 1 -> 2 -> 3 -> 4 -> 5 -> 6 (completed)
v1.1: Phases 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 (completed)
v1.2: Phases 17 -> 18 -> 19

| Phase                                       | Plans Complete | Status      | Completed  |
| ------------------------------------------- | -------------- | ----------- | ---------- |
| 1. Безопасность                             | 3/3            | Complete    | 2026-04-06 |
| 2. Целостность данных                       | 3/3            | Complete    | 2026-04-05 |
| 3. Схема БД                                 | 3/3            | Complete    | 2026-04-06 |
| 4. Заказы и поставщики                      | 2/2            | Complete    | 2026-04-05 |
| 5. Инфраструктура                           | 3/3            | Complete    | 2026-04-06 |
| 6. UX                                       | 3/3            | Complete    | 2026-04-06 |
| 7. Test Infrastructure & Decimal Foundation | 5/5            | Complete    | 2026-04-08 |
| 8. Order/Sale Flow & Предоплаты             | 6/6            | Complete    | 2026-04-09 |
| 9. Race Conditions & Locking                | 3/3            | Complete    | 2026-04-09 |
| 10. Reports Correctness & Banking Fees      | 4/4            | Complete    | 2026-04-11 |
| 11. Repair as Sale                          | 3/3            | Complete    | 2026-04-11 |
| 12. Security Fixes & Roles UI               | 3/3            | Complete    | 2026-04-12 |
| 13. Suppliers & Debts                       | 3/3            | Complete    | 2026-04-13 |
| 14. Payroll & Employee Dashboard            | 2/3            | Complete    | 2026-04-14 |
| 15. Data Integrity Hardening                | 5/5            | Complete    | 2026-04-14 |
| 16. Inventory Edge Cases & UX Polish        | 5/5            | Complete    | 2026-04-18 |
| 17. Build & Seed Safety                     | 3/3 | Complete    | 2026-04-20 |
| 18. Secure Deploy Foundation                | 0/?            | Not started | -          |
| 19. Observability & Runtime Hardening       | 0/?            | Not started | -          |
