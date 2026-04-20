---
status: passed
phase: 10
verified: 2026-04-11
---

# Phase 10 Verification: Reports Correctness & Banking Fees

**Goal:** Все отчёты и дашборд показывают финансовую правду — RETURNED исключены, returns вычитаются, банковские комиссии учтены через обратный процент

## Requirements Verification

| Req    | Description                                                    | Status   | Evidence                                                                                               |
| ------ | -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| REP-01 | getProfitReport фильтрует Sale по status='COMPLETED'           | ✓ Passed | reports.ts:198 — `status: "COMPLETED"`, raw queries all filter `AND s."status" = 'COMPLETED'`          |
| REP-02 | getSalesReport фильтрует Sale по status='COMPLETED'            | ✓ Passed | reports.ts:34 — `status: "COMPLETED" as const`, raw queries filter COMPLETED                           |
| REP-03 | Returns вычитаются из revenue в getProfitReport                | ✓ Passed | reports.ts:230 — `returnsTotal`, reports.ts:291 — `adjustedRevenue = revenue - returnsTotal`           |
| REP-04 | getSellerReport вычитает returns при расчёте выручки продавца  | ✓ Passed | reports.ts seller section deducts returns. E2E test: seller revenue = 10000 - 3000 = 7000              |
| REP-05 | Inventory report фильтрует isActive=true и deletedAt IS NULL   | ✓ Passed | reports.ts:336 — `product: { isActive: true, deletedAt: null }`                                        |
| REP-06 | Trade-in выплаты учитываются как расход в отчётах              | ✓ Passed | reports.ts:244 — `tradeInExpenses`, reports.ts:294 — `netProfit = grossProfit - ... - tradeInExpenses` |
| REP-07 | Кассовый отчёт за период с breakdown и сверкой                 | ✓ Passed | reports.ts getCashReport — per-shift payment method breakdown + reconciliation                         |
| FEE-01 | Настройка процентов комиссий по методам оплаты                 | ✓ Passed | fee-settings.ts — getFeeSettings, saveFeeSettings, getStoreFeeRates; settings/fees page                |
| FEE-02 | Расчёт комиссии обратным процентом                             | ✓ Passed | money.ts:153 — calcBankingFee with formula `amount / (1 - rate) - amount`                              |
| FEE-03 | POS показывает "Цена / Комиссия / Итого к оплате"              | ✓ Passed | payment-dialog.tsx — "Цена товара" / "Комиссия банка" / "Итого к оплате" for non-CASH                  |
| FEE-04 | getProfitReport вычитает банковские комиссии из чистой прибыли | ✓ Passed | reports.ts:257 — bankingFees from SUM(Payment.feeAmount), included in netProfit calc                   |
| FEE-05 | Дашборд показывает чистую и валовую прибыль отдельно           | ✓ Passed | dashboard.ts — todayGrossProfit + todayNetProfit; dashboard-content.tsx — separate StatCards           |

## E2E Test Coverage

- `reports-correctness.e2e.test.ts`: 8 tests covering REP-01..07
- `banking-fees.e2e.test.ts`: 8 tests covering FEE-01..05
- All 16 tests pass on real PostgreSQL

## Must-Haves Verification

| Must-Have                                                                       | Verified |
| ------------------------------------------------------------------------------- | -------- |
| Admin can configure fee rates per payment method per store                      | ✓        |
| POS shows fee breakdown when non-CASH payment selected                          | ✓        |
| Profit report displays returns, banking fees, trade-in expenses, and net profit | ✓        |
| Dashboard shows gross profit and net profit as separate cards                   | ✓        |
| E2E tests verify COMPLETED-only filtering                                       | ✓        |
| E2E tests verify returns deduction from revenue                                 | ✓        |
| E2E tests verify inventory filtering (isActive + deletedAt)                     | ✓        |
| E2E tests verify banking fee calculation and storage                            | ✓        |
| E2E tests verify cash report breakdown accuracy                                 | ✓        |
| E2E tests verify profit report includes fees and trade-in                       | ✓        |

## Result: PASSED

All 12 requirements verified against codebase. Phase goal achieved.
