/*
  Warnings:

  - A unique constraint covering the columns `[reversalOfId]` on the table `CreditMovement` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "CreditMovementType" ADD VALUE 'REVERSAL';

-- AlterTable
ALTER TABLE "CreditMovement" ADD COLUMN     "reversalOfId" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByUserId" TEXT,
ADD COLUMN     "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED';

-- CreateIndex
CREATE UNIQUE INDEX "CreditMovement_reversalOfId_key" ON "CreditMovement"("reversalOfId");

-- CreateIndex
CREATE INDEX "Sale_status_createdAt_idx" ON "Sale"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditMovement" ADD CONSTRAINT "CreditMovement_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "CreditMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
