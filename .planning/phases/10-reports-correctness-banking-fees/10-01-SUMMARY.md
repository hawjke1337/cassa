---
phase: 10-reports-correctness-banking-fees
plan: 01
subsystem: reports, dashboard, schema
tags: [reports, banking-fees, profit, schema-migration, decimal]
dependency_graph:
  requires: [phase-07-decimal-foundation, phase-08-order-sale-flow]
  provides: [PaymentFeeConfig-model, calcBankingFee, corrected-report-queries, dashboard-gross-net]
  affects:
    [src/actions/reports.ts, src/actions/dashboard.ts, prisma/schema.prisma, src/lib/money.ts]
tech_stack:
  added: [PaymentFeeConfig model, Payment.feeAmount column]
  patterns: [reverse-percentage-fee, status-filtered-reports, returns-deduction]
key_files:
  created: []
  modified:
    - prisma/schema.prisma
    - src/lib/money.ts
    - src/lib/money.test.ts
    - src/actions/reports.ts
    - src/actions/dashboard.ts
decisions:
  - "calcBankingFee uses reverse percentage: fee = amount / (1 - rate) - amount"
  - "Backward compat aliases kept for dashboard profit/margin fields"
  - "Trade-in expenses use agreedPrice (not payoutAmount which does not exist)"
  - "Returns deduction via separate query (not LEFT JOIN) for clarity"
metrics:
  duration: 8min
  completed: "2026-04-09"
---

# Phase 10 Plan 01: Schema + Report Backend Fixes Summary

PaymentFeeConfig model with unique(storeId, method), Payment.feeAmount nullable Decimal, calcBankingFee with reverse percentage formula, all 4 report functions fixed for status filtering + returns deduction + inventory filter + trade-in/fees in profit, dashboard gross/net profit split.

## Tasks Completed

| #   | Task                                     | Commit    | Key Changes                                                                                                      |
| --- | ---------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Schema migration + calcBankingFee helper | `3a8df8c` | PaymentFeeConfig model, Payment.feeAmount, calcBankingFee with 7 test cases                                      |
| 2   | Fix report queries                       | `1562443` | status='COMPLETED' filter in all reports, returns deduction, inventory filter, banking fees + trade-in in profit |
| 3   | Dashboard API gross/net split            | pending   | Returns, banking fees, trade-in queries; todayGrossProfit + todayNetProfit; backward compat aliases              |

## Implementation Details

### Task 1: Schema + calcBankingFee (TDD)

- **PaymentFeeConfig model**: id, storeId, method (PaymentMethod), feeRate Decimal(5,4), unique(storeId, method)
- **Payment.feeAmount**: nullable Decimal(12,2) -- stores fee at time of payment
- **calcBankingFee**: reverse percentage formula `amount / (1 - rate) - amount`, precision to 2dp
- **Tests**: 7 cases covering 2%, 0%, 0.7%, 3% rates, zero amount, rate >= 1 guard

### Task 2: Report Query Fixes

- **getSalesReport (REP-01, REP-02)**: Added `status: 'COMPLETED'` to aggregate where + all 3 SQL queries (chart, topByQty, topByRevenue)
- **getProfitReport (REP-01, REP-03, REP-06, FEE-04)**: Status filter on aggregate + COGS + category SQL; returns deduction via separate query; trade-in expenses (SUM agreedPrice where status != PENDING); banking fees (SUM feeAmount); net profit = gross - writeOffs - bankingFees - tradeInExpenses
- **getInventoryReport (REP-05)**: Added `product: { isActive: true, deletedAt: null }` filter
- **getSellerReport (REP-04)**: Status filter + returns deducted from per-seller revenue

### Task 3: Dashboard Gross/Net Split

- Returns, banking fees, trade-in expenses queries added to getDashboardData
- New fields: todayGrossProfit, todayGrossMargin, todayNetProfit, todayBankingFees, todayTradeInExpenses, todayReturns
- Backward compat: `profit` and `margin` aliased to gross values for existing dashboard-content.tsx

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- calcBankingFee: 29/29 tests pass (7 new + 22 existing)
- TypeScript compilation: no errors in reports.ts or dashboard.ts (full project tsc)
- Schema: `prisma db push` applied successfully
- Task 3 commit pending due to session permission issue

## Self-Check: PARTIAL

- [x] prisma/schema.prisma contains `model PaymentFeeConfig`
- [x] prisma/schema.prisma contains `feeAmount Decimal?`
- [x] src/lib/money.ts contains `export function calcBankingFee(`
- [x] src/lib/money.test.ts contains calcBankingFee test cases
- [x] src/actions/reports.ts contains status='COMPLETED' filters
- [x] src/actions/reports.ts contains returns/fees/trade-in queries
- [x] src/actions/dashboard.ts contains gross/net profit split
- [x] Commit 3a8df8c exists (Task 1)
- [x] Commit 1562443 exists (Task 2)
- [ ] Task 3 commit pending
