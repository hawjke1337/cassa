-- DropForeignKey
ALTER TABLE "MotivationAssignment" DROP CONSTRAINT "MotivationAssignment_schemeId_fkey";

-- DropForeignKey
ALTER TABLE "MotivationAssignment" DROP CONSTRAINT "MotivationAssignment_storeId_fkey";

-- DropForeignKey
ALTER TABLE "MotivationAssignment" DROP CONSTRAINT "MotivationAssignment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_repairId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_saleId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnItem" DROP CONSTRAINT "ReturnItem_returnId_fkey";

-- DropForeignKey
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_saleId_fkey";

-- DropForeignKey
ALTER TABLE "SerialUnitHistory" DROP CONSTRAINT "SerialUnitHistory_serialUnitId_fkey";

-- DropForeignKey
ALTER TABLE "UserStore" DROP CONSTRAINT "UserStore_storeId_fkey";

-- DropForeignKey
ALTER TABLE "UserStore" DROP CONSTRAINT "UserStore_userId_fkey";

-- AlterTable: Add updatedAt with default NOW() for existing rows, then drop default
ALTER TABLE "Brand" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Brand" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "CashOperation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "CashOperation" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Category" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Category" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Counter" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Counter" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "CustomOrderItem" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "CustomOrderItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Fund" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Fund" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "InventoryAudit" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "InventoryAudit" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "InventoryAuditItem" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "InventoryAuditItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "InventoryAuditSerial" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "InventoryAuditSerial" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "MotivationAssignment" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "MotivationAssignment" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "MotivationGroupProduct" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "MotivationGroupProduct" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "OrderStatusHistory" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Payment" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Payment" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Payroll" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Payroll" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Permission" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Permission" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "PriceHistory" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "PriceHistory" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "RepairStatusHistory" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "RepairStatusHistory" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Return" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Return" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "ReturnItem" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "ReturnItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Role" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Role" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "RolePermission" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "RolePermission" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Sale" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Sale" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "SaleItem" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "SaleItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "SerialUnitHistory" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "SerialUnitHistory" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "StockReceive" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "StockReceive" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "StockReceiveItem" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "StockReceiveItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "StockTransfer" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "StockTransfer" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "StockTransferItem" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "StockTransferItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "StockTransferItemSerial" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "StockTransferItemSerial" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "StockWriteOff" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "StockWriteOff" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "StockWriteOffItem" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "StockWriteOffItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "StoreProduct" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "StoreProduct" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "SupplierDebt" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "SupplierDebt" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "UserRole" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "UserRole" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "UserStore" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "UserStore" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: Add deletedAt (nullable, no default needed)
ALTER TABLE "Customer" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Store" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Supplier" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");

-- CreateIndex
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");

-- CreateIndex
CREATE INDEX "Store_deletedAt_idx" ON "Store"("deletedAt");

-- CreateIndex
CREATE INDEX "Supplier_deletedAt_idx" ON "Supplier"("deletedAt");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationAssignment" ADD CONSTRAINT "MotivationAssignment_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "MotivationScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationAssignment" ADD CONSTRAINT "MotivationAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationAssignment" ADD CONSTRAINT "MotivationAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnitHistory" ADD CONSTRAINT "SerialUnitHistory_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
