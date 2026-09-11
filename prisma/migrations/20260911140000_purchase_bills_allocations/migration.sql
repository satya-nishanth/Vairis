-- Purchase bills (AP) + cashbook allocations to orders / purchase bills

CREATE TABLE "PurchaseBill" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL,
    "supplierContactId" TEXT,
    "supplierName" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "gstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseBill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseBillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(65,30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseBillLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseBillAttachment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseBillAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceAllocation" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "orderId" TEXT,
    "purchaseBillId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseBill_date_idx" ON "PurchaseBill"("date");
CREATE INDEX "PurchaseBill_supplierContactId_idx" ON "PurchaseBill"("supplierContactId");
CREATE INDEX "PurchaseBill_billNumber_idx" ON "PurchaseBill"("billNumber");
CREATE INDEX "PurchaseBillLine_billId_idx" ON "PurchaseBillLine"("billId");
CREATE INDEX "PurchaseBillAttachment_billId_idx" ON "PurchaseBillAttachment"("billId");
CREATE INDEX "FinanceAllocation_transactionId_idx" ON "FinanceAllocation"("transactionId");
CREATE INDEX "FinanceAllocation_orderId_idx" ON "FinanceAllocation"("orderId");
CREATE INDEX "FinanceAllocation_purchaseBillId_idx" ON "FinanceAllocation"("purchaseBillId");

ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_supplierContactId_fkey" FOREIGN KEY ("supplierContactId") REFERENCES "FinanceContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseBillLine" ADD CONSTRAINT "PurchaseBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseBillAttachment" ADD CONSTRAINT "PurchaseBillAttachment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceAllocation" ADD CONSTRAINT "FinanceAllocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinanceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceAllocation" ADD CONSTRAINT "FinanceAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceAllocation" ADD CONSTRAINT "FinanceAllocation_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
