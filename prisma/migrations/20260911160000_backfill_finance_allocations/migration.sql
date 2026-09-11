-- Backfill FinanceAllocation from legacy FinanceTransactionOrder links.
-- Skip any transaction that already has allocation rows (avoid double-count).

WITH legacy AS (
  SELECT
    fto."transactionId",
    fto."orderId",
    ft."amount"::numeric AS txn_amount,
    COUNT(*) OVER (PARTITION BY fto."transactionId")::int AS link_count,
    ROW_NUMBER() OVER (PARTITION BY fto."transactionId" ORDER BY fto."orderId")::int AS rn
  FROM "FinanceTransactionOrder" fto
  INNER JOIN "FinanceTransaction" ft ON ft."id" = fto."transactionId"
  WHERE NOT EXISTS (
    SELECT 1
    FROM "FinanceAllocation" fa
    WHERE fa."transactionId" = fto."transactionId"
  )
),
split AS (
  SELECT
    "transactionId",
    "orderId",
    link_count,
    rn,
    CASE
      WHEN link_count = 1 THEN ROUND(txn_amount, 2)
      WHEN rn < link_count THEN ROUND(txn_amount / link_count, 2)
      ELSE ROUND(
        txn_amount - (ROUND(txn_amount / link_count, 2) * (link_count - 1)),
        2
      )
    END AS amount
  FROM legacy
)
INSERT INTO "FinanceAllocation" (
  "id",
  "transactionId",
  "amount",
  "orderId",
  "purchaseBillId",
  "createdAt",
  "updatedAt"
)
SELECT
  'fa_bf_' || replace(gen_random_uuid()::text, '-', ''),
  "transactionId",
  amount,
  "orderId",
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM split
WHERE amount > 0;
