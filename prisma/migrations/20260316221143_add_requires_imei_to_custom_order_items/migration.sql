-- AlterTable
ALTER TABLE "CustomOrderItem" ADD COLUMN     "imei" TEXT,
ADD COLUMN     "requiresImei" BOOLEAN NOT NULL DEFAULT false;
