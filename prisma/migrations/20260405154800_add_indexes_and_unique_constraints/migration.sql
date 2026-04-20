-- CreateIndex
CREATE UNIQUE INDEX "Category_name_parentId_key" ON "Category"("name", "parentId");

-- CreateIndex
CREATE INDEX "CustomOrder_storeId_status_idx" ON "CustomOrder"("storeId", "status");

-- CreateIndex
CREATE INDEX "InventoryAudit_storeId_idx" ON "InventoryAudit"("storeId");

-- CreateIndex
CREATE INDEX "MotivationAssignment_schemeId_idx" ON "MotivationAssignment"("schemeId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- CreateIndex
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE INDEX "Payroll_userId_periodStart_idx" ON "Payroll"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "Payroll_storeId_idx" ON "Payroll"("storeId");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_idx" ON "PriceHistory"("productId");

-- CreateIndex
CREATE INDEX "PriceHistory_storeId_idx" ON "PriceHistory"("storeId");

-- CreateIndex
CREATE INDEX "Repair_storeId_status_idx" ON "Repair"("storeId", "status");

-- CreateIndex
CREATE INDEX "RepairStatusHistory_repairId_idx" ON "RepairStatusHistory"("repairId");

-- CreateIndex
CREATE INDEX "Return_saleId_idx" ON "Return"("saleId");

-- CreateIndex
CREATE INDEX "ReturnItem_returnId_idx" ON "ReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "ReturnItem_saleItemId_idx" ON "ReturnItem"("saleItemId");

-- CreateIndex
CREATE INDEX "Sale_storeId_createdAt_idx" ON "Sale"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_sellerId_idx" ON "Sale"("sellerId");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "StockReceive_storeId_createdAt_idx" ON "StockReceive"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "StockReceive_supplierId_idx" ON "StockReceive"("supplierId");

-- CreateIndex
CREATE INDEX "StockTransfer_fromStoreId_idx" ON "StockTransfer"("fromStoreId");

-- CreateIndex
CREATE INDEX "StockTransfer_toStoreId_idx" ON "StockTransfer"("toStoreId");

-- CreateIndex
CREATE INDEX "StockWriteOff_storeId_idx" ON "StockWriteOff"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_inn_key" ON "Supplier"("inn");

-- CreateIndex
CREATE INDEX "SupplierDebt_supplierId_idx" ON "SupplierDebt"("supplierId");
