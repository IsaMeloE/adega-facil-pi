-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'IN_ROUTE', 'DELIVERED');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "deliveryStatus" "DeliveryStatus";
