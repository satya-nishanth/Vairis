# Order Tracking Sync — Design

Date: 2026-08-22
Branch: stage_preprod

## Context

Order status today (SHIPPED → OUT_FOR_DELIVERY → DELIVERED, and the return
flow RETURN_REQUESTED → RETURN_IN_TRANSIT → RETURN_RECEIVED) is 100%
admin-driven — someone has to open every order and click a button, even
though Sequel247's own courier system already knows exactly where the
package is. This plans an automated sync: a cron job polls Sequel247 for
every in-flight order and auto-advances status based on real courier
events, so admin involvement is limited to the cases that genuinely need a
human (anomalies, delivery-failed calls).

Full API reference and status-code research backing this design is archived
outside the repo at
`/Users/nishi/Documents/Personal/Passion Projects/Vairis-all/sequel247-api-docs/`
(`index.md`, `endpoints.md`, `status-mapping.md`) — not duplicated here in
full, referenced throughout.

**Not in scope:** `DELIVERY_FAILED` auto-detection (no reliable Sequel247
signal exists yet — stays manual). Proof-of-delivery document storage
(`/api/podDownload` — nice-to-have, separate future work).

## Sequel247 facts this design depends on

(Full detail in the archived docs; summarized here because they directly
shape the architecture.)

- `shipment_status` is a real top-level field on `/api/track`'s response —
  one of 8 codes: `SCREATED`, `SCHECKIN`, `SLINREC`, `SLINORIN`,
  `SLINDEST`, `SDELASN`, `SDELVD`, `SCANCELLED`.
- `POST /api/trackMultiple` accepts an array of AWBs and returns all of them
  in one call (`successShipments` / `errorShipments`) — the batching
  primitive this cron is built around.
- **Returns are not a status on the original docket.** A return is a
  brand-new docket, booked via a "Reverse Booking" variant of the same
  `/api/shipment/create` endpoint with `fromStoreCode`/`toAddress` roles
  swapped (pickup = customer, drop = our store). It gets tracked through
  the same 8 codes, independently.
- No documented code exists for "delivery failed" or "pickup never
  happened." Confirmed by direct testing, not just missing docs.
- Current code has an unfixed bug: `trackShipment()` reads
  `data.tracking_events`, the real field is `data.tracking`. Currently
  harmless (dead code, nothing calls it) but must be fixed as part of this
  work, since the sync job is what starts actually calling it.

## Architecture

Two independent mechanisms, not one job doing everything:

**1. Reverse-docket booking — synchronous, triggered by `RETURN_REQUESTED`**

Same pattern the app already uses for forward bookings on `SHIPPED`: when
an admin PATCHes an order to `RETURN_REQUESTED`,
`app/api/admin/orders/[id]/route.ts` calls a new
`sequel247Provider.bookReturnShipment()` inline, gets a real AWB back
immediately, and creates a second `Shipment` row (`direction: REVERSE`) on
the order. This is a write, not a poll — it doesn't belong in a 5-minute
cron; waiting up to 5 minutes to arrange a pickup would be a regression
from "click a button, it happens now."

**2. Status sync — GitHub Actions cron, every 5 minutes**

New workflow `.github/workflows/tracking-sync.yml`
(`*/5 * * * *`, Bearer-secret auth, mirrors the existing
`order-sweep.yml` pattern exactly — see `lib/orders` + `app/api/admin/
sweep-orders/route.ts` for the reference pattern). Calls
`POST /api/admin/sync-tracking`, which:

1. Queries `Shipment` rows that are still trackable and not yet terminal:
   `shiprocketId IS NOT NULL` (only API-booked shipments — manually-typed
   ones have no AWB to poll) AND
   (`direction = FORWARD` AND `order.status IN (SHIPPED, OUT_FOR_DELIVERY)`)
   OR (`direction = REVERSE` AND `order.status = RETURN_IN_TRANSIT`).
2. Pages through results in bounded chunks (100 at a time) rather than one
   unbounded query — this is the part built explicitly for scale, so
   growing order volume never turns one cron tick into a giant unbounded
   batch.
3. Per page, one `POST /api/trackMultiple` call with all AWBs in that page.
4. Maps each returned `shipment_status` through `lib/shipping/
   status-sync.ts`'s `mapSequelStatus(code, direction)` — a pure function,
   see below — and applies the resulting action using the *same*
   transition logic the admin PATCH route already uses (extracted into a
   shared function so `OrderEvent` creation, shipment-row updates, and
   email sends stay identical regardless of whether a human clicked or the
   cron did).
5. Updates `Shipment.providerStatusCode` and `lastTrackedAt` on every
   polled docket, even ones that didn't change status — this is what lets
   step 1's query stay cheap (no re-deriving "did this change" from
   scratch) and lets the anomaly check (stuck at `SCREATED` for 48h+) work.
6. Anomalies (see mapping table) trigger a Resend admin email, no status
   change.

## Status mapping (`lib/shipping/status-sync.ts`)

Pure function, no I/O — takes a code + direction, returns an action. Full
reasoning and all 8 codes' descriptions are in the archived
`status-mapping.md`; the actionable table:

| Code | Forward direction | Reverse direction |
|---|---|---|
| `SCREATED` | no-op (order already `SHIPPED`) | no-op (order already `RETURN_IN_TRANSIT`) |
| `SCHECKIN` / `SLINREC` / `SLINORIN` / `SLINDEST` | no-op (in-transit, no Vairis status matches these) | no-op |
| `SDELASN` | → `OUT_FOR_DELIVERY` | no-op (not meaningful for a return leg) |
| `SDELVD` | → `DELIVERED` | → `RETURN_RECEIVED` |
| `SCANCELLED` | **alert** (Sequel247-side cancellation, needs human judgment — no clean Vairis mapping) | **alert** |
| unrecognized code | **alert**, never crash the batch | **alert** |
| `SCREATED` and `lastTrackedAt` > 48h old | **alert** (pickup likely never happened) | **alert** |

`DELIVERY_FAILED` never gets set automatically — no code exists for it, and
the alternative (inferring it from repeated `SDELASN` events) was
explicitly rejected as too speculative. Admin sets it manually if a
customer complains or Sequel247 calls.

## Data model changes

```prisma
enum ShipmentDirection {
  FORWARD
  REVERSE
}

model Shipment {
  // ...existing fields...
  direction          ShipmentDirection @default(FORWARD)
  providerStatusCode String?           // last known Sequel247 shipment_status
  lastTrackedAt       DateTime?         // when providerStatusCode was last refreshed
}
```

## Error handling

- `trackMultiple` call fails (network/5xx) → that page no-ops, retried
  naturally on the next 5-minute tick. No in-run retry — matches
  `sweep-orders`' idempotent-by-design approach, don't add complexity the
  existing pattern doesn't need.
- A docket in `errorShipments` → alert, order untouched, retried next tick.
- Unrecognized `shipment_status` → alert, no transition, rest of the batch
  keeps processing (one bad docket can't take down the run).
- `bookReturnShipment()` failure on `RETURN_REQUESTED` → 502, same UX as
  today's forward-booking failure (admin sees the error, retries, or the
  existing manual-courier-entry fallback applies here too).
- No double-booking risk from overlapping cron runs: booking is
  synchronous and cron-independent; the cron only ever applies idempotent
  status transitions (re-applying `SDELASN → OUT_FOR_DELIVERY` to an order
  already `OUT_FOR_DELIVERY` is a no-op via the existing `ADMIN_TRANSITIONS`
  allowed-move check).

## Testing

- `status-sync.test.ts` — pure function: all 8 codes × both directions,
  unrecognized code, stuck-`SCREATED`-48h case.
- `sync-tracking.test.ts` — mocked `trackMultiple`: happy-path advance,
  order drops out of query once terminal, `errorShipments` handling,
  pagination across 2+ pages, anomaly email firing.
- `sequel247.test.ts` — add `bookReturnShipment()` (asserts role-swapped
  request body: `fromStoreCode` object, `toAddress` string) and fix the
  `tracking` field-name test to match the real API shape.
- Extend the admin orders route test suite for `RETURN_REQUESTED` actually
  triggering a booking call (mirrors the existing `SHIPPED` booking test).

## Open items carried into implementation

- Real `DELIVERY_FAILED`/pickup-never-happened vocabulary unconfirmed —
  either ask Sequel247 (Golden Singh / Paras Nathan, per the archived docs)
  or observe it live once real volume exists.
- New secret needed: a Bearer token for `/api/admin/sync-tracking`
  (`TRACKING_SYNC_SECRET` or similar), wired the same way
  `ORDER_SWEEP_SECRET` is today (Key Vault + GitHub Actions secret) — an
  infra/bicep change, tracked as its own plan task, not detailed here.
