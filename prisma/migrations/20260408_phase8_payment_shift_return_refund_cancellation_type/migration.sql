-- Phase 8 — Order/Sale Flow & Предоплаты
-- Requirements: FIN-06, FIN-09, FIN-11
--
-- Changes:
--   1) CustomOrder.cancellationType TEXT NULL (FIN-06) — тип отмены "HOLD" | "REFUND"
--   2) CustomOrder.cancelReason     TEXT NULL (FIN-06) — текстовая причина отмены (audit)
--   3) Payment.shiftId TEXT NOT NULL  (FIN-11) — каждая оплата обязана быть в смене
--   4) Return.refundMethod NOT NULL   (FIN-09) — метод возврата обязателен
--
-- Backfill strategy для Payment.shiftId (исторические данные v1.0 до shift tracking):
--   Этап 1: через Sale/Order/Repair → shift c временным окном openedAt..closedAt
--   Этап 2: через Sale/Order/Repair → ближайший shift того же storeId по времени
--   Этап 3: через Payment.storeId → ближайший shift того же storeId по времени
--   Guard: если после всех этапов остались NULL — миграция падает с чётким сообщением.

BEGIN;

-- =========================================================================
-- 1) CustomOrder.cancellationType + cancelReason — новые nullable колонки (FIN-06)
-- =========================================================================
ALTER TABLE "CustomOrder"
  ADD COLUMN "cancellationType" TEXT,
  ADD COLUMN "cancelReason"     TEXT;

-- =========================================================================
-- 2) Payment.shiftId — backfill NULLs, затем SET NOT NULL (FIN-11)
-- =========================================================================

-- Drop старый FK (nullable SetNull) чтобы сменить onDelete на Restrict после
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_shiftId_fkey";

-- --- Этап 1: точное совпадение по временному окну через родителя ---

-- 1a) Sale → Shift (window match)
UPDATE "Payment" p
SET "shiftId" = (
  SELECT s.id FROM "Shift" s
  JOIN "Sale" sale ON sale.id = p."saleId"
  WHERE s."storeId" = sale."storeId"
    AND (
      (s."closedAt" IS NOT NULL AND p."createdAt" BETWEEN s."openedAt" AND s."closedAt")
      OR (s."closedAt" IS NULL AND p."createdAt" >= s."openedAt")
    )
  ORDER BY s."openedAt" DESC
  LIMIT 1
)
WHERE p."shiftId" IS NULL AND p."saleId" IS NOT NULL;

-- 1b) CustomOrder → Shift (window match)
UPDATE "Payment" p
SET "shiftId" = (
  SELECT s.id FROM "Shift" s
  JOIN "CustomOrder" co ON co.id = p."orderId"
  WHERE s."storeId" = co."storeId"
    AND (
      (s."closedAt" IS NOT NULL AND p."createdAt" BETWEEN s."openedAt" AND s."closedAt")
      OR (s."closedAt" IS NULL AND p."createdAt" >= s."openedAt")
    )
  ORDER BY s."openedAt" DESC
  LIMIT 1
)
WHERE p."shiftId" IS NULL AND p."orderId" IS NOT NULL;

-- 1c) Repair → Shift (window match)
UPDATE "Payment" p
SET "shiftId" = (
  SELECT s.id FROM "Shift" s
  JOIN "Repair" r ON r.id = p."repairId"
  WHERE s."storeId" = r."storeId"
    AND (
      (s."closedAt" IS NOT NULL AND p."createdAt" BETWEEN s."openedAt" AND s."closedAt")
      OR (s."closedAt" IS NULL AND p."createdAt" >= s."openedAt")
    )
  ORDER BY s."openedAt" DESC
  LIMIT 1
)
WHERE p."shiftId" IS NULL AND p."repairId" IS NOT NULL;

-- --- Этап 2: ближайший shift того же storeId по времени (для исторических data без shift coverage) ---

-- 2a) Sale → nearest Shift
UPDATE "Payment" p
SET "shiftId" = (
  SELECT s.id FROM "Shift" s
  JOIN "Sale" sale ON sale.id = p."saleId"
  WHERE s."storeId" = sale."storeId"
  ORDER BY ABS(EXTRACT(EPOCH FROM (s."openedAt" - p."createdAt"))) ASC
  LIMIT 1
)
WHERE p."shiftId" IS NULL AND p."saleId" IS NOT NULL;

-- 2b) CustomOrder → nearest Shift
UPDATE "Payment" p
SET "shiftId" = (
  SELECT s.id FROM "Shift" s
  JOIN "CustomOrder" co ON co.id = p."orderId"
  WHERE s."storeId" = co."storeId"
  ORDER BY ABS(EXTRACT(EPOCH FROM (s."openedAt" - p."createdAt"))) ASC
  LIMIT 1
)
WHERE p."shiftId" IS NULL AND p."orderId" IS NOT NULL;

-- 2c) Repair → nearest Shift
UPDATE "Payment" p
SET "shiftId" = (
  SELECT s.id FROM "Shift" s
  JOIN "Repair" r ON r.id = p."repairId"
  WHERE s."storeId" = r."storeId"
  ORDER BY ABS(EXTRACT(EPOCH FROM (s."openedAt" - p."createdAt"))) ASC
  LIMIT 1
)
WHERE p."shiftId" IS NULL AND p."repairId" IS NOT NULL;

-- --- Этап 3: orphan Payments без parent — через Payment.storeId ---

UPDATE "Payment" p
SET "shiftId" = (
  SELECT s.id FROM "Shift" s
  WHERE s."storeId" = p."storeId"
  ORDER BY ABS(EXTRACT(EPOCH FROM (s."openedAt" - p."createdAt"))) ASC
  LIMIT 1
)
WHERE p."shiftId" IS NULL AND p."storeId" IS NOT NULL;

-- Guard: fail миграция если остались NULL
DO $$
DECLARE null_count INT;
BEGIN
  SELECT COUNT(*) INTO null_count FROM "Payment" WHERE "shiftId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'FIN-11 backfill failed: % Payment rows still have NULL shiftId. Ensure at least one Shift exists per store before applying migration.', null_count;
  END IF;
END $$;

-- Set NOT NULL
ALTER TABLE "Payment" ALTER COLUMN "shiftId" SET NOT NULL;

-- Re-add FK с ON DELETE RESTRICT (новая семантика: Shift нельзя удалить если есть Payments)
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "Shift"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- =========================================================================
-- 3) Return.refundMethod — backfill from first Sale.Payment.method, SET NOT NULL (FIN-09)
-- =========================================================================
UPDATE "Return" r
SET "refundMethod" = (
  SELECT p."method" FROM "Payment" p
  WHERE p."saleId" = r."saleId"
  ORDER BY p."createdAt" ASC
  LIMIT 1
)
WHERE r."refundMethod" IS NULL;

-- Fallback: если у Sale совсем не было Payments, используем 'CASH'
UPDATE "Return"
SET "refundMethod" = 'CASH'
WHERE "refundMethod" IS NULL;

-- Guard: fail миграция если остались NULL
DO $$
DECLARE null_count INT;
BEGIN
  SELECT COUNT(*) INTO null_count FROM "Return" WHERE "refundMethod" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'FIN-09 backfill failed: % Return rows still have NULL refundMethod. Manual cleanup required.', null_count;
  END IF;
END $$;

ALTER TABLE "Return" ALTER COLUMN "refundMethod" SET NOT NULL;

COMMIT;
