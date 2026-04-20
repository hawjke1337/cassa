-- CreateEnum
CREATE TYPE "SchemeStatus" AS ENUM ('ACTIVE', 'PENDING_APPROVAL', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PAID');

-- CreateTable
CREATE TABLE "MotivationGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotivationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotivationGroupProduct" (
    "groupId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "MotivationGroupProduct_pkey" PRIMARY KEY ("groupId","productId")
);

-- CreateTable
CREATE TABLE "MotivationScheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "formula" JSONB NOT NULL,
    "storeId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "parentSchemeId" TEXT,
    "status" "SchemeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotivationScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotivationAssignment" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "MotivationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "shiftsCount" INTEGER NOT NULL,
    "dailyTotal" DECIMAL(12,2) NOT NULL,
    "commissions" DECIMAL(12,2) NOT NULL,
    "crossBonuses" DECIMAL(12,2) NOT NULL,
    "repairBonuses" DECIMAL(12,2) NOT NULL,
    "returns" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "isAdvance" BOOLEAN NOT NULL DEFAULT false,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MotivationGroup_code_key" ON "MotivationGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MotivationGroupProduct_productId_key" ON "MotivationGroupProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "MotivationAssignment_userId_storeId_startDate_key" ON "MotivationAssignment"("userId", "storeId", "startDate");

-- AddForeignKey
ALTER TABLE "MotivationGroupProduct" ADD CONSTRAINT "MotivationGroupProduct_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MotivationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationGroupProduct" ADD CONSTRAINT "MotivationGroupProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationScheme" ADD CONSTRAINT "MotivationScheme_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationScheme" ADD CONSTRAINT "MotivationScheme_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationScheme" ADD CONSTRAINT "MotivationScheme_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationScheme" ADD CONSTRAINT "MotivationScheme_parentSchemeId_fkey" FOREIGN KEY ("parentSchemeId") REFERENCES "MotivationScheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationAssignment" ADD CONSTRAINT "MotivationAssignment_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "MotivationScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationAssignment" ADD CONSTRAINT "MotivationAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationAssignment" ADD CONSTRAINT "MotivationAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "MotivationScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
