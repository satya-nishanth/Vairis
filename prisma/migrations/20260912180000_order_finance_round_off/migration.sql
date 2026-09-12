-- Round off selling total to nearest rupee on order finance sheets.
ALTER TABLE "OrderFinance" ADD COLUMN "roundOffEnabled" BOOLEAN NOT NULL DEFAULT false;
