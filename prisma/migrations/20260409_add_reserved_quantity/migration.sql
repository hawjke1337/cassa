-- AlterTable: Add reservedQuantity to StoreProduct for LOCK-06 transfer reservation
ALTER TABLE "StoreProduct" ADD COLUMN IF NOT EXISTS "reservedQuantity" INTEGER NOT NULL DEFAULT 0;
