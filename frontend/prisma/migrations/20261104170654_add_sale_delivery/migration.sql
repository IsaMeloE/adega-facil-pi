-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryNotes" TEXT,
ADD COLUMN     "isDelivery" BOOLEAN NOT NULL DEFAULT false;
