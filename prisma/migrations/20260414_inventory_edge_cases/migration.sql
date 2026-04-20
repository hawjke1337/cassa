-- Phase 16 Plan 01: Inventory Edge Cases schema migration
-- Adds:
--   - StoreProductHistory model + StockChangeReason enum
--   - SerialUnitStatus.MISSING
--   - SerialUnitEvent.MISSING, MISSING_RESOLVED
--   - Sale.idempotencyKey unique
--   - StoreProduct.deletedAt (soft-delete support for audit toggle)

-- CreateEnum StockChangeReason
CREATE TYPE "StockChangeReason" AS ENUM (
  'SALE',
  'RETURN',
  'RECEIVE',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'AUDIT_SURPLUS',
  'AUDIT_SHORTAGE',
  'WRITE_OFF',
  'ORDER_COMPLETE'
);

-- AlterEnum SerialUnitStatus + MISSING
ALTER TYPE "SerialUnitStatus" ADD VALUE 'MISSING';

-- AlterEnum SerialUnitEvent + MISSING, MISSING_RESOLVED
ALTER TYPE "SerialUnitEvent" ADD VALUE 'MISSING';
ALTER TYPE "SerialUnitEvent" ADD VALUE 'MISSING_RESOLVED';

-- AlterTable Sale
ALTER TABLE "Sale" ADD COLUMN "idempotencyKey" VARCHAR(36);
CREATE UNIQUE INDEX "Sale_idempotencyKey_key" ON "Sale"("idempotencyKey");

-- AlterTable StoreProduct (soft-delete flag for INV-08)
ALTER TABLE "StoreProduct" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "StoreProduct_deletedAt_idx" ON "StoreProduct"("deletedAt");

-- CreateTable StoreProductHistory
CREATE TABLE "StoreProductHistory" (
    "id" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" "StockChangeReason" NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreProductHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreProductHistory_storeProductId_createdAt_idx"
  ON "StoreProductHistory"("storeProductId", "createdAt");

CREATE INDEX "StoreProductHistory_userId_idx"
  ON "StoreProductHistory"("userId");

ALTER TABLE "StoreProductHistory"
  ADD CONSTRAINT "StoreProductHistory_storeProductId_fkey"
  FOREIGN KEY ("storeProductId") REFERENCES "StoreProduct"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoreProductHistory"
  ADD CONSTRAINT "StoreProductHistory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
