-- Snapshot of estimator breakdown per line at order create time (checkout / admin).
-- Null for existing rows; new orders populate it from calculatePrice().
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "priceBreakdown" JSONB;
