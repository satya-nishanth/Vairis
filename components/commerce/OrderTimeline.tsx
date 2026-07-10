import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_META, TIMELINE_STEPS } from "@/lib/orders";

type OrderTimelineProps = {
  /** Current order status. */
  status: OrderStatus;
  /** Recorded events, oldest first — timestamps shown when available. */
  events: { status: OrderStatus; note: string | null; createdAt: Date }[];
};

/**
 * Customer-facing order progress timeline.
 * Happy path renders as steps (Payment → Crafted → Shipped → Delivered →
 * Deposit Refunded); CANCELLED/REFUNDED orders render the event log only,
 * since the step metaphor no longer applies.
 */
export function OrderTimeline({ status, events }: OrderTimelineProps) {
  const terminal = status === "CANCELLED" || status === "REFUNDED";
  const reachedIndex = TIMELINE_STEPS.indexOf(status);

  const eventFor = (step: OrderStatus) => events.findLast((e) => e.status === step);

  if (terminal) {
    return (
      <ol className="order-timeline order-timeline--log">
        {events.map((e, i) => (
          <li key={i} className="order-timeline__step is-done">
            <span className="order-timeline__dot" aria-hidden />
            <div>
              <strong>{ORDER_STATUS_META[e.status].label}</strong>
              {e.note && <p>{e.note}</p>}
              <time>{formatWhen(e.createdAt)}</time>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
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
