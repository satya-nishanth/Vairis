-- Legacy ₹45 hallmark lived in miscCharges. Certification is first-class now;
-- clear the old flat ₹45 (and matching single-line misc JSON) so shoppers are
-- not charged hallmark twice when store Certification defaults apply.
UPDATE "ProductVariant"
SET
  "miscCharges" = 0,
  "miscChargeLines" = NULL
WHERE "miscCharges" = 45
  AND (
    "miscChargeLines" IS NULL
    OR "miscChargeLines"::text IN ('[]', 'null')
    OR (
      jsonb_typeof("miscChargeLines") = 'array'
      AND jsonb_array_length("miscChargeLines") = 1
      AND COALESCE(("miscChargeLines"->0->>'amount')::numeric, 0) = 45
      AND lower(trim(COALESCE("miscChargeLines"->0->>'label', ''))) IN ('', 'misc', 'hallmark')
    )
  );
