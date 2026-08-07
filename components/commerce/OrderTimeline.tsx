import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_META, TIMELINE_STEPS, isHappyPath } from "@/lib/orders";

type OrderTimelineProps = {
  /** Current order status. */
  status: OrderStatus;
  /** Recorded events, oldest first — timestamps shown when available. */
  events: { status: OrderStatus; note: string | null; createdAt: Date }[];
  /**
   * Customer-visible notes only (caller must already have filtered to
   * `internal: false` — see app/account/orders/[id]/page.tsx and
   * app/api/track-order/route.ts). Merged chronologically into the event
   * log for terminal orders, or listed under "Updates" for happy-path
   * orders. Never pass internal notes here.
   */
  notes?: { body: string; createdAt: Date }[];
};

/**
 * Customer-facing order progress timeline.
 * Happy path renders as steps (Payment → Crafted → Shipped → Delivered →
 * Deposit Refunded); CANCELLED/REFUNDED orders render the event log only,
 * since the step metaphor no longer applies.
 */
export function OrderTimeline({ status, events, notes = [] }: OrderTimelineProps) {
  const terminal = !isHappyPath(status);
  const reachedIndex = TIMELINE_STEPS.indexOf(status);

  const eventFor = (step: OrderStatus) => events.findLast((e) => e.status === step);

  if (terminal) {
    type LogEntry =
      | { kind: "event"; createdAt: Date; status: OrderStatus; note: string | null }
      | { kind: "note"; createdAt: Date; body: string };
    const entries: LogEntry[] = [
      ...events.map((e): LogEntry => ({ kind: "event", createdAt: e.createdAt, status: e.status, note: e.note })),
      ...notes.map((n): LogEntry => ({ kind: "note", createdAt: n.createdAt, body: n.body })),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return (
      <ol className="order-timeline order-timeline--log">
        {entries.map((e, i) => (
          <li key={i} className="order-timeline__step is-done">
            <span className="order-timeline__dot" aria-hidden />
            <div>
              {e.kind === "event" ? (
                <>
                  <strong>{ORDER_STATUS_META[e.status].label}</strong>
                  {e.note && <p>{e.note}</p>}
                </>
              ) : (
                <>
                  <strong>Note</strong>
                  <p>{e.body}</p>
                </>
              )}
              <time>{formatWhen(e.createdAt)}</time>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <>
      <ol className="order-timeline">
        {TIMELINE_STEPS.map((step, i) => {
          const meta = ORDER_STATUS_META[step];
          const done = reachedIndex >= i;
          const active = reachedIndex === i;
          const event = eventFor(step);
          return (
            <li
              key={step}
              className={`order-timeline__step${done ? " is-done" : ""}${active ? " is-active" : ""}`}
            >
              <span className="order-timeline__dot" aria-hidden>
                {done ? "✓" : ""}
              </span>
              <div>
                <strong>{meta.label}</strong>
                <p>{event?.note ?? meta.description}</p>
                {event && <time>{formatWhen(event.createdAt)}</time>}
              </div>
            </li>
          );
        })}
      </ol>
      {notes.length > 0 && (
        <ul className="order-timeline__updates">
          {[...notes]
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((n, i) => (
              <li key={i}>
                <p>{n.body}</p>
                <time>{formatWhen(n.createdAt)}</time>
              </li>
            ))}
        </ul>
      )}
    </>
  );
}

function formatWhen(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status];
  return <span className={`order-chip order-chip--${meta.tone}`}>{meta.label}</span>;
}
