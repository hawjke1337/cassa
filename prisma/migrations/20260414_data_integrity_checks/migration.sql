-- Data Integrity Hardening: CHECK constraints
-- Phase 15, Plan 01: Payment exclusivity, quantity non-negative, SerialUnit uniqueness

-- ============================================================
-- 1. Payment exclusivity CHECK constraint
-- ============================================================
-- isExpense=true => all FKs must be NULL (standalone expense)
-- isExpense=false => exactly one FK must be non-NULL
ALTER TABLE "Payment" ADD CONSTRAINT "chk_payment_exclusivity"
CHECK (
  ("isExpense" = true AND "saleId" IS NULL AND "orderId" IS NULL AND "repairId" IS NULL)
  OR
  ("isExpense" = false AND (
    CASE WHEN "saleId" IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN "orderId" IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN "repairId" IS NOT NULL THEN 1 ELSE 0 END
  ) = 1)
);

-- ============================================================
-- 2. Quantity CHECK constraints (non-negative / positive)
-- ============================================================

-- StoreProduct: quantity and reservedQuantity must be >= 0
ALTER TABLE "StoreProduct" ADD CONSTRAINT "chk_store_product_quantity"
  CHECK ("quantity" >= 0);

ALTER TABLE "StoreProduct" ADD CONSTRAINT "chk_store_product_reserved"
  CHECK ("reservedQuantity" >= 0);

ALTER TABLE "StoreProduct" ADD CONSTRAINT "chk_store_product_min_qty"
  CHECK ("minQty" >= 0);

-- SaleItem: quantity must be > 0 (cannot sell zero or negative items)
ALTER TABLE "SaleItem" ADD CONSTRAINT "chk_sale_item_quantity"
  CHECK ("quantity" > 0);

-- StockReceiveItem: quantity must be > 0
ALTER TABLE "StockReceiveItem" ADD CONSTRAINT "chk_receive_item_quantity"
  CHECK ("quantity" > 0);

-- ReturnItem: quantity must be > 0
ALTER TABLE "ReturnItem" ADD CONSTRAINT "chk_return_item_quantity"
  CHECK ("quantity" > 0);

-- ============================================================
-- 3. SerialUnit partial unique index on [productId, imei]
-- ============================================================
-- imei is already globally @unique, but this compound index provides
-- defense-in-depth if the global unique is ever dropped or relaxed.
-- Partial: only where imei IS NOT NULL (NULL imei = no IMEI tracking).
CREATE UNIQUE INDEX "SerialUnit_productId_imei_unique"
  ON "SerialUnit" ("productId", "imei")
  WHERE "imei" IS NOT NULL;
