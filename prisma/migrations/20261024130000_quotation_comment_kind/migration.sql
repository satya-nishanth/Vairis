-- CreateEnum
CREATE TYPE "QuotationCommentKind" AS ENUM ('INTERNAL', 'CUSTOMER_RESPONSE', 'OUR_RESPONSE');

-- AlterTable
ALTER TABLE "QuotationComment" ADD COLUMN "kind" "QuotationCommentKind" NOT NULL DEFAULT 'INTERNAL';
