-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'IN';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'IN',
ADD COLUMN     "intlReviewApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intlReviewRequired" BOOLEAN NOT NULL DEFAULT false;
