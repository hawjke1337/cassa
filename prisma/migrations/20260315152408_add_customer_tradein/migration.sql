-- CreateEnum
CREATE TYPE "TradeInType" AS ENUM ('TRADE_IN', 'BUYBACK');

-- CreateEnum
CREATE TYPE "TradeInStatus" AS ENUM ('PENDING', 'IN_STOCK', 'IN_REPAIR', 'SOLD', 'WRITTEN_OFF');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'TRADE_IN_CONTRACT';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "isExpense" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storeId" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passportSeries" TEXT,
    "passportNumber" TEXT,
    "passportIssuedBy" TEXT,
    "passportIssuedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeIn" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "TradeInType" NOT NULL,
    "status" "TradeInStatus" NOT NULL DEFAULT 'PENDING',
    "storeId" TEXT NOT NULL,
    "acceptedById" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "deviceBrand" TEXT,
    "deviceModel" TEXT,
    "deviceImei" TEXT,
    "deviceCondition" TEXT NOT NULL,
    "estimatedPrice" DECIMAL(12,2) NOT NULL,
    "agreedPrice" DECIMAL(12,2) NOT NULL,
    "saleId" TEXT,
    "productId" TEXT,
    "repairId" TEXT,
    "payoutId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "TradeIn_number_key" ON "TradeIn"("number");

-- CreateIndex
CREATE UNIQUE INDEX "TradeIn_productId_key" ON "TradeIn"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeIn_repairId_key" ON "TradeIn"("repairId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeIn_payoutId_key" ON "TradeIn"("payoutId");

-- CreateIndex
CREATE INDEX "TradeIn_storeId_status_idx" ON "TradeIn"("storeId", "status");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
