/*
  Warnings:

  - The values [PENDING,ACCEPTED] on the enum `WarrantyClaimStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[serialUnitId]` on the table `CustomOrderItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[serialUnitId]` on the table `SaleItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[serialUnitId]` on the table `StockWriteOffItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[number]` on the table `WarrantyClaim` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdById` to the `WarrantyClaim` table without a default value. This is not possible if the table is not empty.
  - Added the required column `number` to the `WarrantyClaim` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `WarrantyClaim` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `WarrantyClaim` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `WarrantyClaim` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('IMEI', 'SN', 'BOTH');

-- CreateEnum
CREATE TYPE "SerialUnitStatus" AS ENUM ('IN_STOCK', 'SOLD', 'IN_TRANSFER', 'RETURNED', 'WRITTEN_OFF', 'IN_REPAIR');

-- CreateEnum
CREATE TYPE "SerialUnitEvent" AS ENUM ('RECEIVED', 'TRANSFERRED_OUT', 'TRANSFERRED_IN', 'SOLD', 'RETURNED', 'WRITTEN_OFF', 'REPAIR_IN', 'REPAIR_OUT', 'COST_ADJUSTED', 'IMEI_CORRECTED');

-- CreateEnum
CREATE TYPE "RelatedDocType" AS ENUM ('SALE', 'STOCK_RECEIVE', 'STOCK_TRANSFER', 'RETURN', 'WRITE_OFF', 'REPAIR', 'TRADE_IN', 'WARRANTY_CLAIM');

-- CreateEnum
CREATE TYPE "WarrantyClaimType" AS ENUM ('SALE_WARRANTY', 'REPAIR_WARRANTY');

-- CreateEnum
CREATE TYPE "AuditSerialStatus" AS ENUM ('FOUND', 'MISSING', 'SURPLUS');

-- AlterEnum
BEGIN;
CREATE TYPE "WarrantyClaimStatus_new" AS ENUM ('RECEIVED', 'DIAGNOSING', 'SENT_TO_SUPPLIER', 'REPLACEMENT_PENDING', 'RESOLVED', 'REJECTED');
ALTER TABLE "public"."WarrantyClaim" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WarrantyClaim" ALTER COLUMN "status" TYPE "WarrantyClaimStatus_new" USING ("status"::text::"WarrantyClaimStatus_new");
ALTER TYPE "WarrantyClaimStatus" RENAME TO "WarrantyClaimStatus_old";
ALTER TYPE "WarrantyClaimStatus_new" RENAME TO "WarrantyClaimStatus";
DROP TYPE "public"."WarrantyClaimStatus_old";
ALTER TABLE "WarrantyClaim" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';
COMMIT;

-- DropForeignKey
ALTER TABLE "WarrantyClaim" DROP CONSTRAINT "WarrantyClaim_repairId_fkey";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "identifierType" "IdentifierType",
ADD COLUMN     "isSerialized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CustomOrderItem" ADD COLUMN     "serialUnitId" TEXT;

-- AlterTable
ALTER TABLE "Repair" ADD COLUMN     "deviceRecordId" TEXT,
ADD COLUMN     "serialUnitId" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "serialUnitId" TEXT;

-- AlterTable
ALTER TABLE "StockWriteOffItem" ADD COLUMN     "serialUnitId" TEXT,
ADD COLUMN     "writeOffReason" TEXT;

-- AlterTable
ALTER TABLE "TradeIn" ADD COLUMN     "deviceRecordId" TEXT;

-- AlterTable
ALTER TABLE "WarrantyClaim" ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "deviceRecordId" TEXT,
ADD COLUMN     "number" TEXT NOT NULL,
ADD COLUMN     "serialUnitId" TEXT,
ADD COLUMN     "storeId" TEXT NOT NULL,
ADD COLUMN     "type" "WarrantyClaimType" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "repairId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

-- CreateTable
CREATE TABLE "SerialUnit" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "imei" TEXT,
    "imei2" TEXT,
    "serialNumber" TEXT,
    "status" "SerialUnitStatus" NOT NULL DEFAULT 'IN_STOCK',
    "costPrice" DECIMAL(12,2) NOT NULL,
    "warrantyDays" INTEGER NOT NULL DEFAULT 365,
    "receiveItemId" TEXT,
    "deviceRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerialUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialUnitHistory" (
    "id" TEXT NOT NULL,
    "serialUnitId" TEXT NOT NULL,
    "event" "SerialUnitEvent" NOT NULL,
    "storeId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "relatedDocument" TEXT,
    "relatedDocType" "RelatedDocType",
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerialUnitHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceRecord" (
    "id" TEXT NOT NULL,
    "imei" TEXT,
    "imei2" TEXT,
    "serialNumber" TEXT,
    "deviceType" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItemSerial" (
    "id" TEXT NOT NULL,
    "transferItemId" TEXT NOT NULL,
    "serialUnitId" TEXT NOT NULL,

    CONSTRAINT "StockTransferItemSerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAuditSerial" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "auditItemId" TEXT NOT NULL,
    "serialUnitId" TEXT,
    "scannedImei" TEXT NOT NULL,
    "status" "AuditSerialStatus" NOT NULL,

    CONSTRAINT "InventoryAuditSerial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SerialUnit_imei_key" ON "SerialUnit"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "SerialUnit_imei2_key" ON "SerialUnit"("imei2");

-- CreateIndex
CREATE INDEX "SerialUnit_productId_storeId_status_idx" ON "SerialUnit"("productId", "storeId", "status");

-- CreateIndex
CREATE INDEX "SerialUnit_storeId_status_idx" ON "SerialUnit"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SerialUnit_productId_serialNumber_key" ON "SerialUnit"("productId", "serialNumber");

-- CreateIndex
CREATE INDEX "SerialUnitHistory_serialUnitId_createdAt_idx" ON "SerialUnitHistory"("serialUnitId", "createdAt");

-- CreateIndex
CREATE INDEX "SerialUnitHistory_storeId_createdAt_idx" ON "SerialUnitHistory"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceRecord_imei_key" ON "DeviceRecord"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceRecord_imei2_key" ON "DeviceRecord"("imei2");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceRecord_serialNumber_key" ON "DeviceRecord"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransferItemSerial_transferItemId_serialUnitId_key" ON "StockTransferItemSerial"("transferItemId", "serialUnitId");

-- CreateIndex
CREATE INDEX "InventoryAuditSerial_auditId_status_idx" ON "InventoryAuditSerial"("auditId", "status");

-- CreateIndex
CREATE INDEX "InventoryAuditSerial_auditItemId_idx" ON "InventoryAuditSerial"("auditItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomOrderItem_serialUnitId_key" ON "CustomOrderItem"("serialUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_serialUnitId_key" ON "SaleItem"("serialUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "StockWriteOffItem_serialUnitId_key" ON "StockWriteOffItem"("serialUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyClaim_number_key" ON "WarrantyClaim"("number");

-- CreateIndex
CREATE INDEX "WarrantyClaim_storeId_status_idx" ON "WarrantyClaim"("storeId", "status");

-- CreateIndex
CREATE INDEX "WarrantyClaim_type_status_idx" ON "WarrantyClaim"("type", "status");

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockWriteOffItem" ADD CONSTRAINT "StockWriteOffItem_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_deviceRecordId_fkey" FOREIGN KEY ("deviceRecordId") REFERENCES "DeviceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_deviceRecordId_fkey" FOREIGN KEY ("deviceRecordId") REFERENCES "DeviceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_deviceRecordId_fkey" FOREIGN KEY ("deviceRecordId") REFERENCES "DeviceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_receiveItemId_fkey" FOREIGN KEY ("receiveItemId") REFERENCES "StockReceiveItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_deviceRecordId_fkey" FOREIGN KEY ("deviceRecordId") REFERENCES "DeviceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnitHistory" ADD CONSTRAINT "SerialUnitHistory_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnitHistory" ADD CONSTRAINT "SerialUnitHistory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnitHistory" ADD CONSTRAINT "SerialUnitHistory_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceRecord" ADD CONSTRAINT "DeviceRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItemSerial" ADD CONSTRAINT "StockTransferItemSerial_transferItemId_fkey" FOREIGN KEY ("transferItemId") REFERENCES "StockTransferItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItemSerial" ADD CONSTRAINT "StockTransferItemSerial_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAuditSerial" ADD CONSTRAINT "InventoryAuditSerial_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "InventoryAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAuditSerial" ADD CONSTRAINT "InventoryAuditSerial_auditItemId_fkey" FOREIGN KEY ("auditItemId") REFERENCES "InventoryAuditItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAuditSerial" ADD CONSTRAINT "InventoryAuditSerial_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
