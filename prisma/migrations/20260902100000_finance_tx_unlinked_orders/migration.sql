-- Allow finance transactions to reference orders by name without linking to Order rows.
ALTER TABLE "FinanceTransaction" ADD COLUMN "unlinkedOrderLabels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
