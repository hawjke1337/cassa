-- ============================================================
-- Data Cleanup: исправить невалидные данные перед CHECK constraints
-- ============================================================

-- StoreProduct: отрицательные остатки -> 0
UPDATE "StoreProduct" SET quantity = 0 WHERE quantity < 0;
UPDATE "StoreProduct" SET "sellPrice" = 0 WHERE "sellPrice" < 0;
UPDATE "StoreProduct" SET "costPrice" = 0 WHERE "costPrice" < 0;

-- SaleItem: невалидные значения
UPDATE "SaleItem" SET price = 0 WHERE price < 0;
UPDATE "SaleItem" SET "costPrice" = 0 WHERE "costPrice" < 0;
UPDATE "SaleItem" SET quantity = 1 WHERE quantity <= 0;

-- Payment: невалидные суммы
UPDATE "Payment" SET amount = 0.01 WHERE amount <= 0;

-- StockReceiveItem
UPDATE "StockReceiveItem" SET quantity = 1 WHERE quantity <= 0;
UPDATE "StockReceiveItem" SET "costPrice" = 0 WHERE "costPrice" < 0;

-- Return
UPDATE "Return" SET amount = 0 WHERE amount < 0;
UPDATE "ReturnItem" SET quantity = 1 WHERE quantity <= 0;

-- ============================================================
-- CHECK Constraints
-- ============================================================

-- StoreProduct
ALTER TABLE "StoreProduct" ADD CONSTRAINT chk_store_product_quantity_gte0
  CHECK (quantity >= 0);
ALTER TABLE "StoreProduct" ADD CONSTRAINT chk_store_product_sell_price_gte0
  CHECK ("sellPrice" >= 0);
ALTER TABLE "StoreProduct" ADD CONSTRAINT chk_store_product_cost_price_gte0
  CHECK ("costPrice" >= 0);

-- SaleItem
ALTER TABLE "SaleItem" ADD CONSTRAINT chk_sale_item_price_gte0
  CHECK (price >= 0);
ALTER TABLE "SaleItem" ADD CONSTRAINT chk_sale_item_cost_price_gte0
  CHECK ("costPrice" >= 0);
ALTER TABLE "SaleItem" ADD CONSTRAINT chk_sale_item_quantity_gt0
  CHECK (quantity > 0);

-- Payment
ALTER TABLE "Payment" ADD CONSTRAINT chk_payment_amount_gt0
  CHECK (amount > 0);

-- StockReceiveItem
ALTER TABLE "StockReceiveItem" ADD CONSTRAINT chk_stock_receive_item_quantity_gt0
  CHECK (quantity > 0);
ALTER TABLE "StockReceiveItem" ADD CONSTRAINT chk_stock_receive_item_cost_price_gte0
  CHECK ("costPrice" >= 0);

-- Return
ALTER TABLE "Return" ADD CONSTRAINT chk_return_amount_gte0
  CHECK (amount >= 0);

-- ReturnItem
ALTER TABLE "ReturnItem" ADD CONSTRAINT chk_return_item_quantity_gt0
  CHECK (quantity > 0);
