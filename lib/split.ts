import type { Prisma } from "@prisma/client";

/**
 * Auto-split (spec §5): any order with ≥2 line items splits into one child
 * order per line item, at whichever moment the parent is confirmed/created:
 *
 *   - online checkout: called from confirmPayment right after the parent
 *     flips PAYMENT_PENDING → PAYMENT_CONFIRMED, inside the SAME transaction
 *     (see lib/payments/webhook-handlers.ts).
 *   - manual/WhatsApp orders: called right after admin creates the order
 *     (app/api/admin/orders/route.ts POST), whatever initialStatus was
 *     chosen. A still-unpaid multi-item WhatsApp deal splits immediately too
 *     — there's no later "confirmation" hook for offline orders, so admin
 *     confirms each delivery independently afterward via the per-child
 *     OFFLINE_SETTLEMENT_TRANSITIONS mark (PAYMENT_PENDING → PAYMENT_CONFIRMED
 *     on that one child).
 *
 * Children inherit the parent's status AT SPLIT TIME (read fresh inside this
 * function, not hardcoded) so both call sites above produce the right child
 * state without two code paths — for the online/paid-manual case that's
 * PAYMENT_CONFIRMED per spec; for a pending manual split it's PAYMENT_PENDING.
 *
 * PAYMENT ANCHORING: the Payment row stays on the PARENT forever. Children
 * carry prorated amounts and parentOrderId; money actions on children walk
 * up via lib/refunds.resolvePayment.
 *
 * Runs INSIDE the caller's transaction (tx) so the parent status change and
 * the split are atomic.
 */
export async function autoSplitOrder(tx: Prisma.TransactionClient, orderId: string): Promise<string[]> {
  const parent = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!parent || parent.items.length < 2 || parent.parentOrderId) return [];

  const childStatus = parent.status;
  const parentGoods = Number(parent.totalAmount);
  const parentDeposit = Number(parent.depositAmount);
  const parentGrand = Number(parent.grandTotal);

  // Prorate; last child absorbs rounding remainders so sums match exactly.
  let usedDeposit = 0;
  let usedGrand = 0;
  const childIds: string[] = [];

  for (let i = 0; i < parent.items.length; i++) {
    const item = parent.items[i];
    const goods = Number(item.price) * item.quantity;
    const last = i === parent.items.length - 1;
    const deposit = last ? parentDeposit - usedDeposit : Math.round(parentDeposit * (goods / parentGoods));
    const grand = last ? parentGrand - usedGrand : goods + deposit;
    usedDeposit += deposit;
    usedGrand += grand;

    const child = await tx.order.create({
      data: {
        userId: parent.userId,
        parentOrderId: parent.id,
        status: childStatus,
        totalAmount: goods,
        depositAmount: deposit,
        grandTotal: grand,
        contactName: parent.contactName,
        contactPhone: parent.contactPhone,
        addressLine1: parent.addressLine1,
        addressLine2: parent.addressLine2,
        city: parent.city,
        state: parent.state,
        pincode: parent.pincode,
        events: {
          create: {
            status: childStatus,
            note: `Delivery ${i + 1} of ${parent.items.length} — split from order ${parent.id}`,
          },
        },
      },
    });
    // Move the line item to the child (parent keeps the receipt via events + payment)
    await tx.orderItem.update({ where: { id: item.id }, data: { orderId: child.id } });
    childIds.push(child.id);
  }

  await tx.order.update({
    where: { id: parent.id },
    data: {
      status: "SPLIT_INTO_DELIVERIES",
      events: {
        create: {
          status: "SPLIT_INTO_DELIVERIES",
          note: `Split into ${childIds.length} deliveries: ${childIds.join(", ")}`,
        },
      },
    },
  });

  return childIds;
}
