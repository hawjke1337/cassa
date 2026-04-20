---
phase: 15-data-integrity-hardening
plan: 03
subsystem: data-integrity
tags: [phone-normalization, imei-validation, luhn, zod, server-actions]

# Dependency graph
requires:
  - phase: 07-test-infrastructure
    provides: vitest e2e test infrastructure
provides:
  - "normalizePhone() / isValidPhone() / normalizePhoneOrThrow() utilities"
  - "validateImeiOrThrow() throwing IMEI validation"
  - "Phone normalization at all entity entry points"
  - "IMEI Luhn validation at repair/trade-in/order entry points"
affects: [16-inventory-edge-cases-ux-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [phone-normalization-before-storage, imei-luhn-validation-at-entry]

key-files:
  created:
    - src/lib/phone-utils.ts
    - src/__tests__/e2e/phone-imei-normalization.e2e.test.ts
  modified:
    - src/lib/imei-utils.ts
    - src/lib/validations/serial.ts
    - src/actions/repairs.ts
    - src/actions/orders.ts
    - src/actions/trade-in.ts
    - src/actions/customers.ts
    - src/actions/suppliers.ts
    - src/actions/settings.ts

key-decisions:
  - "IMEI validation in repairs only when deviceSerial matches 15-digit pattern (not all serial numbers)"
  - "Store/User/Supplier phone fields are optional -- normalize only when non-empty"
  - "Users and stores actions are in settings.ts, not separate files -- applied normalization there"

patterns-established:
  - "normalizePhoneOrThrow before any phone DB write: guards +7XXXXXXXXXX format"
  - "validateImeiOrThrow before any IMEI DB write: Luhn check + 15 digits"

requirements-completed: [DATA2-05, DATA2-08]

# Metrics
duration: 7min
completed: 2026-04-14
---

# Phase 15 Plan 03: Phone & IMEI Normalization Summary

**Phone normalization to +7XXXXXXXXXX and IMEI Luhn validation at all server action entry points with 21 E2E tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-14T10:39:25Z
- **Completed:** 2026-04-14T10:46:29Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Created phone-utils.ts with normalizePhone, isValidPhone, normalizePhoneOrThrow for Russian phone format (+7XXXXXXXXXX)
- Extended imei-utils.ts with validateImeiOrThrow throwing variant
- Applied phone normalization to all 6 action files: repairs, orders, customers, suppliers, settings (stores + users + profile)
- Applied IMEI validation to repairs (deviceSerial), orders (updateOrderItemImei), trade-in (deviceImei)
- 21 E2E tests covering all phone formats, edge cases, IMEI validation, and error messages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create normalizePhone + extend IMEI validation** - `e6061d4` (feat)
2. **Task 2: Wire phone normalization into repair-flow actions + E2E tests** - `634d4e8` (feat)
3. **Task 3: Wire phone normalization into entity-management actions** - `0a057ce` (feat)

## Files Created/Modified
- `src/lib/phone-utils.ts` - Phone normalization utilities (normalizePhone, isValidPhone, normalizePhoneOrThrow)
- `src/lib/imei-utils.ts` - Added validateImeiOrThrow throwing variant
- `src/lib/validations/serial.ts` - Added phoneField Zod schema + isValidPhone import
- `src/actions/repairs.ts` - normalizePhoneOrThrow for clientPhone, validateImeiOrThrow for deviceSerial
- `src/actions/orders.ts` - normalizePhoneOrThrow for clientPhone, validateImeiOrThrow for updateOrderItemImei
- `src/actions/trade-in.ts` - validateImeiOrThrow for deviceImei in createTradeIn
- `src/actions/customers.ts` - normalizePhoneOrThrow for createCustomer/updateCustomer
- `src/actions/suppliers.ts` - normalizePhoneOrThrow for createSupplier/updateSupplier
- `src/actions/settings.ts` - normalizePhoneOrThrow for createStore/updateStore/createUser/updateUser/updateProfile
- `src/__tests__/e2e/phone-imei-normalization.e2e.test.ts` - 21 tests for phone/IMEI utilities

## Decisions Made
- IMEI validation in repairs only when deviceSerial matches 15-digit pattern (deviceSerial can be a generic serial number, not always IMEI)
- Store/User/Supplier phone fields are optional -- normalize only when provided and non-empty
- Users and stores management actions live in settings.ts (not separate users.ts/stores.ts) -- applied normalization there instead

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] settings.ts instead of stores.ts/users.ts**
- **Found during:** Task 3
- **Issue:** Plan referenced src/actions/stores.ts and src/actions/users.ts which don't exist -- createStore/updateStore/createUser/updateUser live in src/actions/settings.ts
- **Fix:** Applied normalizePhoneOrThrow to settings.ts instead, covering stores, users, and profile
- **Files modified:** src/actions/settings.ts
- **Verification:** grep confirms normalizePhoneOrThrow in all relevant files
- **Committed in:** 0a057ce (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking -- wrong file paths in plan)
**Impact on plan:** Necessary path correction. All entity entry points covered as intended. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All phone fields normalized before storage across the system
- All IMEI fields validated (Luhn check) before storage
- Ready for remaining Phase 15 plans

---
*Phase: 15-data-integrity-hardening*
*Completed: 2026-04-14*
