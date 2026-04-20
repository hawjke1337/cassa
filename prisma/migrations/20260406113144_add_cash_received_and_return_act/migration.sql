-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'RETURN_ACT';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "cashReceived" DECIMAL(12,2),
ADD COLUMN     "changeAmount" DECIMAL(12,2);
