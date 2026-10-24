-- STG-61: older invoices stored PAID because /paid/i matched the substring in "Unpaid".
-- Recompute from payload.payment.status (same rules as isInvoicePaymentPaid).
UPDATE "Invoice"
SET status = 'UNPAID',
    "updatedAt" = NOW()
WHERE status = 'PAID'
  AND (
    LOWER(TRIM(COALESCE(payload->'payment'->>'status', ''))) LIKE '%unpaid%'
    OR TRIM(COALESCE(payload->'payment'->>'status', '')) = ''
  );
