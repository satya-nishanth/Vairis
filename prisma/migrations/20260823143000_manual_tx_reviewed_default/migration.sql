-- Manual cashbook rows start as Reviewed; auto-created stay For review.
UPDATE "FinanceTransaction" SET "reviewComplete" = true WHERE "autoCreated" = false;
