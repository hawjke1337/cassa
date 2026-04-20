# Requirements: ePRM — POS-система a:store

**Defined:** 2026-04-05
**Core Value:** Продавец может быстро и безошибочно оформить продажу, возврат, приём на ремонт и trade-in — с корректным учётом остатков, серийных номеров и денежных средств.

## v1 Requirements

### Безопасность POS

- [x] **SEC-01**: Сервер валидирует цену продажи из БД (sellPrice из StoreProduct), а не принимает от клиента
- [x] **SEC-02**: Сервер валидирует costPrice из БД, а не принимает от клиента
- [x] **SEC-03**: Сервер валидирует что discount >= 0 и discount <= price
- [x] **SEC-04**: Сервер валидирует что quantity > 0 и является целым числом
- [x] **SEC-05**: Продажа запрещена без открытой кассовой смены (или требует явного подтверждения)
- [x] **SEC-06**: Возврат проверяет что продажа принадлежит текущему магазину (storeId)

### Безопасность Auth

- [x] **AUTH-01**: JWT обновляет permissions при изменении ролей пользователя (короткий maxAge + refresh)
- [x] **AUTH-02**: Rate limiting на логин (блокировка после N неудачных попыток)
- [x] **AUTH-03**: Минимальная длина пароля 8 символов
- [x] **AUTH-04**: writeSerialHistory не экспортируется как server action (вынести из "use server" файла)

### Безопасность Permissions

- [x] **PERM-01**: Trade-in actions проверяют storeId в requirePermission
- [x] **PERM-02**: Отчёты проверяют storeId в requirePermission
- [x] **PERM-03**: Payroll: отдельные permissions для view/manage/confirm/pay (не view для всего)
- [x] **PERM-04**: getDocumentData для RECEIVE_DOC и WRITE_OFF_DOC проверяет permissions
- [x] **PERM-05**: getCurrentShift и checkOpenShift проверяют store-scoped permissions

### Целостность данных

- [x] **DATA-01**: SELECT FOR UPDATE на StoreProduct.quantity при продаже (race condition остатков)
- [x] **DATA-02**: getNextNumber внутри транзакции (race condition нумерации)
- [x] **DATA-03**: Средневзвешенная costPrice при приёмке (не перезапись последним приходом)
- [x] **DATA-04**: Отмена заказа откатывает все побочные эффекты (платежи, серийники, долги)
- [x] **DATA-05**: sellPrice != 0 при создании StoreProduct для серийных товаров (fallback на costPrice \* markup)
- [x] **DATA-06**: Исправление расчёта комиссий при частичном возврате (не терять невозвращённые единицы)
- [x] **DATA-07**: Валидация rate в формулах мотивации (max=1 для PERCENT, разумный max для FIXED)
- [x] **DATA-08**: Авто-закрытие смены рассчитывает expectedCash и discrepancy (не null)
- [x] **DATA-09**: searchSaleByNumber использует exact match (не contains)
- [x] **DATA-10**: deleteTradeIn проверяет статус (нельзя удалить IN_STOCK/SOLD/IN_REPAIR)

### Схема БД

- [x] **DB-01**: Добавить 35+ отсутствующих индексов (Sale, SaleItem, Payment, StockReceive, Repair, и др.)
- [x] **DB-02**: Добавить onDelete правила на все FK (Cascade/Restrict/SetNull)
- [x] **DB-03**: PriceHistory: storeId и changedBy как FK на Store и User
- [x] **DB-04**: Soft delete (deletedAt) на Product, Supplier, Customer, Store, User
- [x] **DB-05**: updatedAt на Sale, Payment, Return, все Items-таблицы
- [x] **DB-06**: CHECK constraints (price >= 0, quantity > 0, amount > 0)
- [x] **DB-07**: @@unique на Supplier.inn, @@unique на [Category.name, Category.parentId]

### Заказы и поставщики

- [x] **ORD-01**: Выпадающий список поставщиков при создании заказа
- [x] **ORD-02**: Ввод закупочной цены и стоимости доставки после завершения заказа (отдельный permission)
- [x] **ORD-03**: Расчёт чистой прибыли по заказу (продажа - закупка - доставка)
- [x] **ORD-04**: Автоматический учёт долга поставщику при подтверждении заказа
- [x] **ORD-05**: Отчёт по долгам поставщикам
- [x] **ORD-06**: Комиссия продавца от заказов в мотивации считается от чистой прибыли (после закупки + доставки)
- [x] **ORD-07**: Скидка при выдаче заказа (discountAmount в Sale не хардкодить 0)
- [x] **ORD-08**: Редактирование цены товара из каталога в заказе (индивидуальная скидка)

### Инфраструктура

- [ ] **INFRA-01**: Vitest — unit/integration тесты для критичной бизнес-логики
- [ ] **INFRA-02**: error.tsx в каждом route segment (ошибки != белый экран)
- [ ] **INFRA-03**: loading.tsx в ключевых route segments
- [x] **INFRA-04**: Отчёты: SQL-агрегация вместо загрузки всех данных в память
- [x] **INFRA-05**: Docker: healthcheck, prisma migrate deploy при старте, env variables вместо хардкода
- [x] **INFRA-06**: next.config: poweredByHeader: false, security headers
- [x] **INFRA-07**: Prettier + Husky + lint-staged
- [ ] **INFRA-08**: revalidatePath/revalidateTag после мутаций в catalog, settings, suppliers, customers

### UX POS

- [ ] **UX-01**: Debounce на всех поисковых полях (POS, заказы, склад)
- [ ] **UX-02**: Персистентная корзина POS (Zustand persist middleware)
- [x] **UX-03**: Запись полученной суммы наличных и сдачи в БД + отображение в чеке
- [ ] **UX-04**: Исправление конфликта Escape между диалогами и очисткой корзины
- [ ] **UX-05**: Авто-добавление товара по штрихкоду (EAN-13, не только IMEI)
- [x] **UX-06**: Поле комментария к продаже в PaymentDialog
- [x] **UX-07**: Печатная форма возврата (акт возврата)
- [x] **UX-08**: Защита от двойного клика на "Подтвердить оплату"
- [x] **UX-09**: История продаж / поиск по продажам в POS

### UX Dashboard и навигация

- [x] **UX-10**: Прибыль/маржа на дашборде (ключевая метрика владельца)
- [x] **UX-11**: Breadcrumbs для всех 14 маршрутов (сейчас 8)
- [x] **UX-12**: Ошибка загрузки дашборда показывается через toast (не проглатывается молча)
- [x] **UX-13**: readyRepairsCount отображается на дашборде (данные есть, UI нет)
- [x] **UX-14**: Время смены в формате "Xч Yм" (не в минутах)
- [x] **UX-15**: Нативный select -> shadcn Select в возвратах

## v2 Requirements

### Аналитика

- **ANLYT-01**: Графики динамики продаж на дашборде (день/неделя/месяц)
- **ANLYT-02**: Топ товаров за период
- **ANLYT-03**: Кассовый баланс (наличные в кассе) на дашборде
- **ANLYT-04**: Сравнение с прошлой неделей/месяцем
- **ANLYT-05**: Экспорт отчётов (CSV, Excel, PDF)

### Расширения

- **EXT-01**: Переключатель dark/light theme (основа есть в CSS)
- **EXT-02**: Accessibility: aria-labels, role, keyboard navigation на дашборде
- **EXT-03**: Пагинация для getCustomers, getTradeIns, getSerialUnitsForProduct
- **EXT-04**: Кликабельные строки в таблице склада (переход к деталям товара)
- **EXT-05**: Фильтр "только в наличии" на складе
- **EXT-06**: Статус WAITING_PARTS для ремонтов
- **EXT-07**: Валидация телефона с маской ввода
- **EXT-08**: Подтверждение при уходе со страницы с несохранёнными данными

---

## v1.1 Requirements — Financial Integrity & Security

**Defined:** 2026-04-08
**Source:** 100 bugs from manual QA + multi-agent audit (`Obsidian Mind/Bugs/ePRM — Баги v1.0 QA.md`)
**Goal:** Закрыть финансовые, security и integrity баги; production-готовность ePRM.

### Order/Sale Flow & Предоплаты (FIN)

- [x] **FIN-01**: При завершении заказа Sale.finalAmount = totalAmount - discount - prepaidAmount (предоплата учтена) [BUG-024]
- [x] **FIN-02**: При завершении заказа stock декрементится для всех позиций (как в createSale) [BUG-023]
- [x] **FIN-03**: При завершении заказа serialUnits помечаются SOLD корректно для всех связанных items [BUG-023]
- [x] **FIN-04**: При отмене заказа оператор делает явный выбор: "Удержать предоплату" (default) или "Вернуть клиенту" [BUG-025, project_prepayment_rule]
- [x] **FIN-05**: При выборе "Вернуть" создаётся CashOperation изъятие + Payment isExpense=true с привязкой к Order [BUG-025]
- [x] **FIN-06**: При выборе "Удержать" Payment остаётся, статус → CANCELLED, удержанная сумма видна как доход [BUG-025]
- [x] **FIN-07**: Order и Sale статусы синхронизированы — если Sale возвращён, Order тоже (или явная связь) [BUG-042] (impl complete 08-04; full-return assertOrderSaleLink edge-case → Phase 9)
- [x] **FIN-08**: Частичный возврат — расчёт refund использует discount per-unit (discount/quantity), не total [BUG-018] (impl complete 08-02; partial-return E2E Decimal precision → Phase 15)
- [x] **FIN-09**: Return.refundMethod ОБЯЗАТЕЛЕН (not nullable), валидируется от метода оригинального Payment [BUG-038]
- [x] **FIN-10**: Return midway failure не оставляет Sale в COMPLETED — статус обновляется атомарно [BUG-057]
- [x] **FIN-11**: При оплате заказа без открытой смены — блокировка или явное предупреждение, shiftId не null [BUG-041]
- [x] **FIN-12**: Переплата заказа (totalPaid > totalAmount) блокируется или создаёт credit balance с явным флагом [BUG-039]

### Race Conditions & Locking (LOCK)

- [x] **LOCK-01**: createSale для серийного товара использует SELECT FOR UPDATE на SerialUnit (не findUnique) [BUG-044]
- [x] **LOCK-02**: confirmTransferSent блокирует StoreProduct через FOR UPDATE для несерийных [BUG-045]
- [x] **LOCK-03**: createSale декрементит stock ДО создания Sale (или объединено с Sale.create) [BUG-046]
- [x] **LOCK-04**: confirmReceive обрабатывает failure внутри SerialUnit-цикла без orphaned StoreProduct [BUG-047]
- [x] **LOCK-05**: createWriteOff блокирует StoreProduct через FOR UPDATE [BUG-053]
- [x] **LOCK-06**: Stock Transfer резервирует stock в источнике с момента PENDING (не на confirmSent) [BUG-080]

### Reports Correctness (REP)

- [x] **REP-01**: getProfitReport фильтрует Sale по status='COMPLETED' (исключает RETURNED/PARTIALLY_RETURNED) [BUG-094]
- [x] **REP-02**: getSalesReport фильтрует Sale по status='COMPLETED' [BUG-095]
- [x] **REP-03**: Returns вычитаются из revenue в getProfitReport (LEFT JOIN Return) [BUG-097]
- [x] **REP-04**: getSellerReport вычитает returns при расчёте выручки продавца [BUG-099]
- [x] **REP-05**: Inventory report фильтрует product.isActive=true и deletedAt IS NULL [BUG-098]
- [x] **REP-06**: Trade-in выплаты учитываются как расход магазина в финансовых отчётах [BUG-100]
- [x] **REP-07**: Кассовый отчёт за период (наличные/карта/СБП breakdown, сверка с кассой) [BUG-019]

### Banking Fees (FEE)

- [x] **FEE-01**: Настройка процентов комиссий по методам оплаты (CARD, SBP, TRANSFER, CREDIT, CASH=0) [BUG-012]
- [x] **FEE-02**: Расчёт комиссии **обратным процентом** (formula эквайринга): commission = amount/(1-rate) - amount [BUG-012]
- [x] **FEE-03**: При оплате в POS: показ "Цена / Комиссия / Итого к оплате" [BUG-012]
- [x] **FEE-04**: getProfitReport вычитает банковские комиссии из чистой прибыли [BUG-096]
- [x] **FEE-05**: Дашборд показывает чистую прибыль (после комиссий) и валовую отдельно [BUG-096]

### Repair as Sale (REPAIR)

- [x] **REPAIR-01**: При DELIVERED ремонте создаётся Sale-запись с finalCost как revenue [BUG-026]
- [x] **REPAIR-02**: getDashboardData revenue включает Repair выручку (Sale из ремонтов) [BUG-028]
- [x] **REPAIR-03**: При использовании запчастей в ремонте — StoreProduct.quantity декрементится [BUG-027]
- [x] **REPAIR-04**: Запчасти ремонта учитываются как COGS в отчёте по прибыли [BUG-027]
- [x] **REPAIR-05**: RepairCostHistory таблица — аудит изменений estimatedCost/agreedCost/finalCost [BUG-031]
- [x] **REPAIR-06**: Изменение стоимости ремонта запрещено после статуса COMPLETED/DELIVERED [BUG-031]
- [x] **REPAIR-07**: Гарантия не находит проданный IMEI — фильтр расширен на SOLD+IN_STOCK [BUG-011]
- [x] **REPAIR-08**: Гарантия проверяет warrantyUntil не истёк перед созданием WarrantyClaim [BUG-075]
- [x] **REPAIR-09**: Поиск гарантии работает по IMEI, номеру чека, номеру продажи [BUG-011]

### Security Fixes (SEC2)

- [x] **SEC2-01**: getSale проверяет requirePermission по sale.storeId (закрытие IDOR) [BUG-058]
- [x] **SEC2-02**: db.ts soft delete расширение перехватывает findUnique [BUG-059]
- [x] **SEC2-03**: Reports с reports.full проверяют доступ юзера к requested storeId [BUG-060]
- [x] **SEC2-04**: updateOrderStatus для COMPLETED проверяет pos.discount_high при скидке > 30% [BUG-061]
- [x] **SEC2-05**: createCashOperation: верхний лимит amount, проверка баланса фонда [BUG-062]
- [x] **SEC2-06**: Rate limiting на createSale, createReceive, createOrder [BUG-063]
- [x] **SEC2-07**: closeShift с большим discrepancy требует approval старшего (или фото/подпись) [BUG-064]
- [x] **SEC2-08**: updateUserRoles запрещает менять свою роль (userId !== session.user.id) [BUG-065]
- [x] **SEC2-09**: updateOrderItem: hard cap на price change > 30% (проверка прав) [BUG-066]
- [x] **SEC2-10**: AuditLog таблица — структурированный лог изменений ролей и привилегий [BUG-067]

### Suppliers & Debts (SUP)

- [x] **SUP-01**: SupplierDebt создаётся от purchasePrice (не от totalAmount/sellPrice) [BUG-022]
- [ ] **SUP-02**: При создании заказа поле purchasePrice обязательное для перехода в ORDERED [BUG-022]
- [x] **SUP-03**: Карточка заказа показывает: Цена клиенту / Закуп / Прибыль отдельно [BUG-022]
- [x] **SUP-04**: Город поставщика автозаполняется из Supplier.city при ORDERED [BUG-003]
- [x] **SUP-05**: SupplierDebt.amount можно обновить (если фактический счёт изменился) [BUG-032]
- [x] **SUP-06**: markSupplierDebtPaid создаёт CashOperation изъятие + Payment isExpense=true [BUG-033]
- [x] **SUP-07**: Страница /suppliers/debts — сводка всех долгов с фильтрами и итогами [BUG-009]
- [x] **SUP-08**: Дашборд: карточка "Долги поставщикам: X ₽ (N неоплаченных)" [BUG-009]
- [x] **SUP-09**: История платежей поставщику в его карточке [BUG-009]

### Payroll & Employee Dashboard (PAYROLL)

- [x] **PAYROLL-01**: Order commission per-item (не total netProfit на каждую позицию) [BUG-029]
- [ ] **PAYROLL-02**: Sale поддерживает co-seller (минимум 2 sellerId) для split-комиссий [BUG-030]
- [x] **PAYROLL-03**: Личный кабинет /my/payroll — продавец видит свои продажи по магазинам и сменам [BUG-017]
- [x] **PAYROLL-04**: Расшифровка комиссии: товар, цена, прибыль, % → сумма [BUG-017]
- [x] **PAYROLL-05**: История начислений по месяцам в личном кабинете [BUG-017]
- [x] **PAYROLL-06**: Сотрудник видит ТОЛЬКО свои данные (storeId scope) [BUG-017]

### Roles & Settings UI (ROLE)

- [x] **ROLE-01**: Страница /settings/roles — список ролей с CRUD [BUG-010]
- [x] **ROLE-02**: Матрица прав: чекбоксы permissions по категориям (POS, заказы, склад, отчёты, настройки) [BUG-010]
- [x] **ROLE-03**: Назначение роли пользователю при создании/редактировании [BUG-010]
- [x] **ROLE-04**: Удаление клиентов из UI (soft delete) [BUG-013]
- [x] **ROLE-05**: Удаление магазинов из UI (soft delete с проверкой остатков) [BUG-013]

### Data Integrity (DATA2)

- [x] **DATA2-01**: Payment имеет CHECK constraint: ровно один из (saleId, orderId, repairId) NOT NULL [BUG-068]
- [x] **DATA2-02**: Все денежные расчёты используют Decimal.js или integer-копейки (не Number) [BUG-069]
- [x] **DATA2-03**: Текстовые поля имеют @db.VarChar(N) (Sale.comment, Return.reason, Repair.diagnosis и др.) [BUG-070]
- [x] **DATA2-04**: Reports/dashboard используют UTC при date filtering (Date.UTC) [BUG-071]
- [x] **DATA2-05**: IMEI валидация во всех точках (receive, update, trade-in, import) [BUG-072]
- [x] **DATA2-06**: User cascade deletion → SetNull для UserRole/UserStore (сохранить историю) [BUG-073]
- [x] **DATA2-07**: CHECK constraints на все quantity-поля (StoreProduct, SaleItem, StockReceiveItem) [BUG-074]
- [x] **DATA2-08**: normalizePhone() применяется на input во всех create/update (Customer, User, Store, Supplier) [BUG-076]
- [x] **DATA2-09**: SerialUnit @@unique([productId, imei]) при imei not null (закрыть NULL-дубль) [BUG-077]
- [x] **DATA2-10**: MotivationScheme.formula валидация на UPDATE + snapshot при применении [BUG-078]
- [x] **DATA2-11**: Optimistic locking (version field) для MotivationScheme и других concurrent-edited [BUG-079]
- [x] **DATA2-12**: DeviceRecord — деduplication по IMEI при повторных ремонтах [BUG-081]

### Inventory Edge Cases (INV)

- [x] **INV-01**: Изменение Category.isSerialized — guard или migration tool [BUG-048]
- [x] **INV-02**: Inventory audit "MISSING" серийники — SerialUnit.status переключается на MISSING/WRITTEN_OFF [BUG-049]
- [x] **INV-03**: Audit пересчитывает expected qty на момент закрытия (учитывая продажи в процессе) [BUG-050]
- [x] **INV-04**: StoreProductHistory таблица — лог изменений quantity (кто/когда/почему) [BUG-051]
- [x] **INV-05**: Stock Transfer с null sourceSp валидируется (не создавать с ценой 0) [BUG-052]
- [x] **INV-06**: Receive создаёт StoreProduct с sellPrice = costPrice \* markup (не 0) [BUG-054]
- [x] **INV-07**: Trade-In agreedPrice=0 — warning или явное "бесплатный приём" с пометкой в отчётах [BUG-055]
- [x] **INV-08**: Soft-deleted продукты видны в инвентаризации (фильтр deletedAt) [BUG-056]
- [x] **INV-09**: Trade-In → создание товара возможно из IN_STOCK (не только PENDING) [BUG-008]

### UX Polish (UX2)

- [x] **UX2-01**: createReturn требует AlertDialog подтверждения [BUG-082]
- [x] **UX2-02**: PaymentDialog double-click защита через ref-lock или useTransition [BUG-083]
- [x] **UX2-03**: closeShift с расхождением — финальное подтверждение "Подтвердить расхождение X₽?" [BUG-084]
- [x] **UX2-04**: Корзина блокируется пока открыт PaymentDialog (global payment-in-progress lock) [BUG-085]
- [x] **UX2-05**: Toast ошибок имеет кнопку "Повторить" для критичных операций [BUG-086]
- [x] **UX2-06**: Recovery после refresh — server-side проверка существования продажи (idempotency-key) [BUG-087]
- [x] **UX2-07**: Inline валидация форм (красные рамки, helper text) [BUG-088]
- [x] **UX2-08**: POS responsive layout для планшетов (breakpoints) [BUG-089]
- [x] **UX2-09**: ARIA labels на кастомных компонентах (SerialUnitPicker и др.) [BUG-090]
- [x] **UX2-10**: Print preview перед window.print() [BUG-091]
- [x] **UX2-11**: Trade-In: одно поле "Цена выкупа" вместо двух (Оценка/Согласовано) ИЛИ flow по шагам [BUG-002]
- [x] **UX2-12**: Печать бланка заказа — выводит наименование товара [BUG-004]
- [x] **UX2-13**: Приём оплаты заказа меньше остатка — предупреждение [BUG-005]
- [x] **UX2-14**: Чек продажи показывает IMEI для серийных товаров [BUG-006]
- [x] **UX2-15**: Чек агрегирует платежи одного метода (одна строка "Наличные: 75 000 ₽") [BUG-007]
- [x] **UX2-16**: Объединение каталога и склада в один раздел + кнопка "Продать" [BUG-015]
- [x] **UX2-17**: POS — каталог категорий вместо пустого поиска [BUG-016]

### E2E Testing (TEST2)

- [x] **TEST2-01**: E2E тесты на реальной БД для каждой фазы v1.1 (паттерн e2e-real-db.test.ts)
- [x] **TEST2-02**: Test database setup/teardown — фикстуры для seed данных
- [~] **TEST2-03**: CI запускает E2E + unit на каждый коммит (postgres сервис в GitHub Actions) — _Частично: workflow создан (commits 2bd4f4f, 077fb70), branch protection отложена до публикации проекта на GitHub_

## v1.2 Requirements — Production Hardening

**Defined:** 2026-04-18
**Goal:** Закрыть production-readiness gap'ы найденные в post-v1.1 audit (7 критических блокеров + улучшения). После v1.2 приложение безопасно деплоится на VPS с TLS, автобэкапами, мониторингом.

### Build & Seed Safety (BUILD)

- [x] **BUILD-01**: `pnpm typecheck` проходит с 0 ошибок (сейчас 35 ошибок в motivation-\*, repairs.ts, trade-in.ts, test-файлах)
- [x] **BUILD-02**: `prisma/seed.ts` отказывается работать если `NODE_ENV === 'production'` без явного `SEED_ALLOW_PROD=true`. Prod-seed создаёт только первого admin с генерируемым паролем (показан при setup)
- [x] **BUILD-03**: `pnpm build` собирает production-bundle без warnings (проверить что next.config не падает в prod mode)

### Deploy (DEPLOY)

- [ ] **DEPLOY-01**: `docker-compose.prod.yml` с приложением, PostgreSQL, reverse proxy; порт 5432 НЕ expose в интернет, пароли из `.env` (не литерал)
- [ ] **DEPLOY-02**: Reverse proxy (caddy) с автопровизией TLS от Let's Encrypt, HTTP→HTTPS redirect, HSTS заголовок
- [ ] **DEPLOY-03**: Автобэкап PostgreSQL: ежедневный `pg_dump` (cron в контейнере), retention 30 дней, документация по restore
- [ ] **DEPLOY-04**: Документация `docs/DEPLOYMENT.md` — пошаговая инструкция deploy на чистый VPS (DNS, firewall, docker-compose up, первый вход)

### Observability (OBS)

- [ ] **OBS-01**: Sentry SDK подключён (next-auth, server actions, API routes, client errors); source maps загружаются при build; PII scrubbing настроен (логин не шлётся)
- [ ] **OBS-02**: Structured logging через pino (замена 16 `console.*` в server коде); log level конфигурируется через env; формат JSON в prod
- [ ] **OBS-03**: `/api/health` расширен: проверяет БД, Redis (если подключён), disk space; возвращает JSON с метриками
- [ ] **OBS-04**: `/api/metrics` Prometheus endpoint (без auth, защищён network layer в compose) — базовые метрики: request count, duration, error rate, БД pool usage

### Security Hardening (SEC3)

- [ ] **SEC3-01**: `.env.production.example` с полным списком переменных: `DATABASE_URL`, `NEXTAUTH_SECRET` (c комментарием generate via openssl), `NEXTAUTH_URL` (https://), `SENTRY_DSN`, `REDIS_URL` (опц), backup destinations
- [ ] **SEC3-02**: Secure cookies в prod: `secure: true`, `sameSite: 'strict'`, `httpOnly: true` в next-auth конфиге; explicit NEXTAUTH_URL validation (https://)
- [ ] **SEC3-03**: Rate limiting переписан на Redis-backed ИЛИ зафиксирован single-instance deploy constraint + документировано в DEPLOYMENT.md (после rotation окно сбрасывается)
- [ ] **SEC3-04**: CSP headers в next.config (script-src 'self', style-src 'self' 'unsafe-inline' для Tailwind, img-src 'self' data:); report-only режим до стабилизации, затем enforce
- [ ] **SEC3-05**: Аудит `$queryRawUnsafe` / `Prisma.raw` в src/actions/\*\* — все input параметры должны быть через whitelist или через `Prisma.sql` template literal; документировать почему `reports.ts` использует `Prisma.raw` для truncUnit

### Performance (PERF)

- [ ] **PERF-01**: Connection pooling настроен: либо PgBouncer в docker-compose (transaction mode), либо `?connection_limit=10&pool_timeout=30` в DATABASE_URL с документацией тюнинга

## v1.1 Out of Scope

| Feature                          | Reason                                               |
| -------------------------------- | ---------------------------------------------------- |
| Reset до версии 1.0 при rollback | Миграции backward-compatible — rollback по миграциям |
| Real-time обновления (WebSocket) | Polling достаточно для 10 пользователей              |
| Mobile app                       | PWA позже (v2)                                       |
| Полная замена next-auth          | Beta стабильна, риск замены > выгоды                 |
| OAuth providers (Google/Yandex)  | Логин/пароль достаточно                              |
| Email-уведомления                | Telegram bot позже                                   |

---

## Out of Scope (legacy v1.0)

| Feature                      | Reason                                 |
| ---------------------------- | -------------------------------------- |
| Онлайн-оплата                | Будет в E-Commerce проекте (Medusa.js) |
| Маркетплейсы (Ozon, WB)      | Не нужны (решение владельца)           |
| Доставка (СДЭК, Почта)       | Только самовывоз                       |
| Мобильное приложение         | PWA позже                              |
| Парсинг цен                  | Отдельный проект (Price Parser)        |
| i18n                         | Только русский язык                    |
| Шифрование паспортных данных | Перенесено в v2 (152-ФЗ)               |
| Service layer рефакторинг    | Перенесено в v2 (после стабилизации)   |

## Traceability

| Requirement | Phase   | Plan  | Status  |
| ----------- | ------- | ----- | ------- |
| SEC-01      | Phase 1 | 01-01 | Pending |
| SEC-02      | Phase 1 | 01-01 | Pending |
| SEC-03      | Phase 1 | 01-01 | Pending |
| SEC-04      | Phase 1 | 01-01 | Pending |
| SEC-05      | Phase 1 | 01-01 | Pending |
| SEC-06      | Phase 1 | 01-01 | Pending |
| AUTH-01     | Phase 1 | 01-02 | Pending |
| AUTH-02     | Phase 1 | 01-02 | Pending |
| AUTH-03     | Phase 1 | 01-02 | Pending |
| AUTH-04     | Phase 1 | 01-02 | Pending |
| PERM-01     | Phase 1 | 01-03 | Pending |
| PERM-02     | Phase 1 | 01-03 | Pending |
| PERM-03     | Phase 1 | 01-03 | Pending |
| PERM-04     | Phase 1 | 01-03 | Pending |
| PERM-05     | Phase 1 | 01-03 | Pending |
| DATA-01     | Phase 2 | 02-01 | Pending |
| DATA-02     | Phase 2 | 02-01 | Pending |
| DATA-03     | Phase 2 | 02-02 | Pending |
| DATA-04     | Phase 2 | 02-03 | Pending |
| DATA-05     | Phase 2 | 02-02 | Pending |
| DATA-06     | Phase 2 | 02-02 | Pending |
| DATA-07     | Phase 2 | 02-02 | Pending |
| DATA-08     | Phase 2 | 02-03 | Pending |
| DATA-09     | Phase 2 | 02-03 | Pending |
| DATA-10     | Phase 2 | 02-03 | Pending |
| DB-01       | Phase 3 | 03-01 | Pending |
| DB-02       | Phase 3 | 03-02 | Pending |
| DB-03       | Phase 3 | 03-02 | Pending |
| DB-04       | Phase 3 | 03-02 | Pending |
| DB-05       | Phase 3 | 03-02 | Pending |
| DB-06       | Phase 3 | 03-03 | Pending |
| DB-07       | Phase 3 | 03-01 | Pending |
| ORD-01      | Phase 4 | 04-01 | Pending |
| ORD-02      | Phase 4 | 04-01 | Pending |
| ORD-03      | Phase 4 | 04-01 | Pending |
| ORD-04      | Phase 4 | 04-01 | Pending |
| ORD-05      | Phase 4 | 04-02 | Pending |
| ORD-06      | Phase 4 | 04-02 | Pending |
| ORD-07      | Phase 4 | 04-02 | Pending |
| ORD-08      | Phase 4 | 04-02 | Pending |
| INFRA-01    | Phase 5 | 05-01 | Pending |
| INFRA-02    | Phase 5 | 05-02 | Pending |
| INFRA-03    | Phase 5 | 05-02 | Pending |
| INFRA-04    | Phase 5 | 05-03 | Pending |
| INFRA-05    | Phase 5 | 05-03 | Pending |
| INFRA-06    | Phase 5 | 05-03 | Pending |
| INFRA-07    | Phase 5 | 05-03 | Pending |
| INFRA-08    | Phase 5 | 05-02 | Pending |
| UX-01       | Phase 6 | 06-01 | Pending |
| UX-02       | Phase 6 | 06-01 | Pending |
| UX-03       | Phase 6 | 06-02 | Pending |
| UX-04       | Phase 6 | 06-01 | Pending |
| UX-05       | Phase 6 | 06-01 | Pending |
| UX-06       | Phase 6 | 06-02 | Pending |
| UX-07       | Phase 6 | 06-02 | Pending |
| UX-08       | Phase 6 | 06-02 | Pending |
| UX-09       | Phase 6 | 06-02 | Pending |
| UX-10       | Phase 6 | 06-03 | Pending |
| UX-11       | Phase 6 | 06-03 | Pending |
| UX-12       | Phase 6 | 06-03 | Pending |
| UX-13       | Phase 6 | 06-03 | Pending |
| UX-14       | Phase 6 | 06-03 | Pending |
| UX-15       | Phase 6 | 06-03 | Pending |

**Coverage:**

- v1 requirements: 58 total
- Mapped to phases: 58
- Mapped to plans: 58
- Unmapped: 0

---

_Requirements defined: 2026-04-05_
_Last updated: 2026-04-05 -- roadmap created, traceability expanded to individual requirements_

## v1.1 Traceability

| Requirement | Phase    | Plan  | Status                                               |
| ----------- | -------- | ----- | ---------------------------------------------------- |
| TEST2-01    | Phase 7  | TBD   | Pending                                              |
| TEST2-02    | Phase 7  | TBD   | Pending                                              |
| TEST2-03    | Phase 7  | 07-04 | Partial (workflow ready, branch protection deferred) |
| DATA2-02    | Phase 7  | 07-03 | Complete                                             |
| FIN-01      | Phase 8  | 08-03 | Complete                                             |
| FIN-02      | Phase 8  | 08-03 | Complete                                             |
| FIN-03      | Phase 8  | 08-03 | Complete                                             |
| FIN-04      | Phase 8  | 08-05 | Complete                                             |
| FIN-05      | Phase 8  | 08-03 | Complete                                             |
| FIN-06      | Phase 8  | 08-03 | Complete                                             |
| FIN-07      | Phase 8  | 08-04 | Complete (full-return edge → Phase 9)                |
| FIN-08      | Phase 8  | 08-02 | Complete (partial-return E2E precision → Phase 15)   |
| FIN-09      | Phase 8  | 08-04 | Complete                                             |
| FIN-10      | Phase 8  | 08-04 | Complete                                             |
| FIN-11      | Phase 8  | 08-02 | Complete                                             |
| FIN-12      | Phase 8  | 08-03 | Complete                                             |
| LOCK-01     | Phase 9  | TBD   | Pending                                              |
| LOCK-02     | Phase 9  | TBD   | Pending                                              |
| LOCK-03     | Phase 9  | TBD   | Pending                                              |
| LOCK-04     | Phase 9  | TBD   | Pending                                              |
| LOCK-05     | Phase 9  | TBD   | Pending                                              |
| LOCK-06     | Phase 9  | TBD   | Pending                                              |
| REP-01      | Phase 10 | TBD   | Pending                                              |
| REP-02      | Phase 10 | TBD   | Pending                                              |
| REP-03      | Phase 10 | TBD   | Pending                                              |
| REP-04      | Phase 10 | TBD   | Pending                                              |
| REP-05      | Phase 10 | TBD   | Pending                                              |
| REP-06      | Phase 10 | TBD   | Pending                                              |
| REP-07      | Phase 10 | TBD   | Pending                                              |
| FEE-01      | Phase 10 | TBD   | Pending                                              |
| FEE-02      | Phase 10 | TBD   | Pending                                              |
| FEE-03      | Phase 10 | TBD   | Pending                                              |
| FEE-04      | Phase 10 | TBD   | Pending                                              |
| FEE-05      | Phase 10 | TBD   | Pending                                              |
| REPAIR-01   | Phase 11 | TBD   | Pending                                              |
| REPAIR-02   | Phase 11 | TBD   | Pending                                              |
| REPAIR-03   | Phase 11 | TBD   | Pending                                              |
| REPAIR-04   | Phase 11 | TBD   | Pending                                              |
| REPAIR-05   | Phase 11 | TBD   | Pending                                              |
| REPAIR-06   | Phase 11 | TBD   | Pending                                              |
| REPAIR-07   | Phase 11 | TBD   | Pending                                              |
| REPAIR-08   | Phase 11 | TBD   | Pending                                              |
| REPAIR-09   | Phase 11 | TBD   | Pending                                              |
| SEC2-01     | Phase 12 | 12-01 | Completed (2026-04-12) — IDOR fix on getSale         |
| SEC2-02     | Phase 12 | 12-01 | Completed (2026-04-12) — findUnique soft delete       |
| SEC2-03     | Phase 12 | 12-01 | Completed (2026-04-12) — Reports storeId checks       |
| SEC2-04     | Phase 12 | 12-01 | Completed (2026-04-12) — Discount >30% guard          |
| SEC2-05     | Phase 12 | 12-01 | Completed (2026-04-12) — Cash op 500k cap              |
| SEC2-06     | Phase 12 | 12-01 | Completed (2026-04-12) — Write rate limiting           |
| SEC2-07     | Phase 12 | 12-01 | Completed (2026-04-12) — Shift discrepancy approval    |
| SEC2-08     | Phase 12 | 12-01 | Completed (2026-04-12) — Self-role change prevention   |
| SEC2-09     | Phase 12 | 12-01 | Completed (2026-04-12) — Price change >30% guard       |
| SEC2-10     | Phase 12 | 12-02 | Completed (2026-04-12) — AuditLog infrastructure      |
| ROLE-01     | Phase 12 | 12-03 | Completed (2026-04-12) — Roles CRUD UI                 |
| ROLE-02     | Phase 12 | 12-03 | Completed (2026-04-12) — Permission matrix             |
| ROLE-03     | Phase 12 | 12-03 | Completed (2026-04-12) — User role assignment           |
| ROLE-04     | Phase 12 | 12-03 | Completed (2026-04-12) — Customer soft delete           |
| ROLE-05     | Phase 12 | 12-03 | Completed (2026-04-12) — Store soft delete              |
| SUP-01      | Phase 13 | TBD   | Pending                                              |
| SUP-02      | Phase 13 | TBD   | Pending                                              |
| SUP-03      | Phase 13 | TBD   | Pending                                              |
| SUP-04      | Phase 13 | TBD   | Pending                                              |
| SUP-05      | Phase 13 | TBD   | Pending                                              |
| SUP-06      | Phase 13 | TBD   | Pending                                              |
| SUP-07      | Phase 13 | TBD   | Pending                                              |
| SUP-08      | Phase 13 | TBD   | Pending                                              |
| SUP-09      | Phase 13 | TBD   | Pending                                              |
| PAYROLL-01  | Phase 14 | TBD   | Pending                                              |
| PAYROLL-02  | Phase 14 | TBD   | Pending                                              |
| PAYROLL-03  | Phase 14 | TBD   | Pending                                              |
| PAYROLL-04  | Phase 14 | TBD   | Pending                                              |
| PAYROLL-05  | Phase 14 | TBD   | Pending                                              |
| PAYROLL-06  | Phase 14 | TBD   | Pending                                              |
| DATA2-01    | Phase 15 | TBD   | Pending                                              |
| DATA2-03    | Phase 15 | TBD   | Pending                                              |
| DATA2-04    | Phase 15 | TBD   | Pending                                              |
| DATA2-05    | Phase 15 | TBD   | Pending                                              |
| DATA2-06    | Phase 15 | TBD   | Pending                                              |
| DATA2-07    | Phase 15 | TBD   | Pending                                              |
| DATA2-08    | Phase 15 | TBD   | Pending                                              |
| DATA2-09    | Phase 15 | TBD   | Pending                                              |
| DATA2-10    | Phase 15 | TBD   | Pending                                              |
| DATA2-11    | Phase 15 | TBD   | Pending                                              |
| DATA2-12    | Phase 15 | TBD   | Pending                                              |
| INV-01      | Phase 16 | TBD   | Pending                                              |
| INV-02      | Phase 16 | TBD   | Pending                                              |
| INV-03      | Phase 16 | TBD   | Pending                                              |
| INV-04      | Phase 16 | TBD   | Pending                                              |
| INV-05      | Phase 16 | TBD   | Pending                                              |
| INV-06      | Phase 16 | TBD   | Pending                                              |
| INV-07      | Phase 16 | TBD   | Pending                                              |
| INV-08      | Phase 16 | TBD   | Pending                                              |
| INV-09      | Phase 16 | TBD   | Pending                                              |
| UX2-01      | Phase 16 | TBD   | Pending                                              |
| UX2-02      | Phase 16 | TBD   | Pending                                              |
| UX2-03      | Phase 16 | TBD   | Pending                                              |
| UX2-04      | Phase 16 | TBD   | Pending                                              |
| UX2-05      | Phase 16 | TBD   | Pending                                              |
| UX2-06      | Phase 16 | TBD   | Pending                                              |
| UX2-07      | Phase 16 | TBD   | Pending                                              |
| UX2-08      | Phase 16 | TBD   | Pending                                              |
| UX2-09      | Phase 16 | TBD   | Pending                                              |
| UX2-10      | Phase 16 | TBD   | Pending                                              |
| UX2-11      | Phase 16 | TBD   | Pending                                              |
| UX2-12      | Phase 16 | TBD   | Pending                                              |
| UX2-13      | Phase 16 | TBD   | Pending                                              |
| UX2-14      | Phase 16 | TBD   | Pending                                              |
| UX2-15      | Phase 16 | TBD   | Pending                                              |
| UX2-16      | Phase 16 | TBD   | Pending                                              |
| UX2-17      | Phase 16 | TBD   | Pending                                              |

**v1.1 Coverage:**

- v1.1 requirements: 110 total
- Mapped to phases: 110
- Unmapped: 0

---

_v1.1 traceability added: 2026-04-08 — roadmap v1.1 created (10 phases, Phase 7-16)_

## v1.2 Traceability

| Requirement | Phase    | Plan | Status  |
| ----------- | -------- | ---- | ------- |
| BUILD-01    | Phase 17 | 17-01 | Complete |
| BUILD-02    | Phase 17 | 17-02 | Complete |
| BUILD-03    | Phase 17 | 17-03 | Complete |
| DEPLOY-01   | Phase 18 | TBD  | Pending |
| DEPLOY-02   | Phase 18 | TBD  | Pending |
| DEPLOY-03   | Phase 18 | TBD  | Pending |
| DEPLOY-04   | Phase 18 | TBD  | Pending |
| SEC3-01     | Phase 18 | TBD  | Pending |
| SEC3-02     | Phase 18 | TBD  | Pending |
| SEC3-03     | Phase 18 | TBD  | Pending |
| OBS-01      | Phase 19 | TBD  | Pending |
| OBS-02      | Phase 19 | TBD  | Pending |
| OBS-03      | Phase 19 | TBD  | Pending |
| OBS-04      | Phase 19 | TBD  | Pending |
| SEC3-04     | Phase 19 | TBD  | Pending |
| SEC3-05     | Phase 19 | TBD  | Pending |
| PERF-01     | Phase 19 | TBD  | Pending |

**v1.2 Coverage:**

- v1.2 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

**v1.2 Phase Distribution:**

- Phase 17 (Build & Seed Safety): 3 requirements (BUILD-01..03)
- Phase 18 (Secure Deploy Foundation): 7 requirements (DEPLOY-01..04, SEC3-01..03)
- Phase 19 (Observability & Runtime Hardening): 7 requirements (OBS-01..04, SEC3-04..05, PERF-01)

---

_v1.2 traceability added: 2026-04-18 — roadmap v1.2 created (3 phases, Phase 17-19, Production Hardening)_
