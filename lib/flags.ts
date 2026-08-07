/**
 * Feature flags.
 *
 * ─── CHECKOUT_ENABLED ────────────────────────────────────────────────────
 * Razorpay is not fully live yet, so self-serve checkout is OFF by default:
 * the storefront runs in "WhatsApp enquiry" mode — PDP/PLP show only
 * "Enquire on WhatsApp", the cart icon and /cart + /checkout pages are
 * disabled. Sales negotiated on WhatsApp are recorded by admins via
 * /admin/orders/new, so the full order journey (My Orders, tracking,
 * timeline, status emails) works for customers regardless.
 *
 * To go live with online payments, set in env (Vercel + .env.local):
 *   NEXT_PUBLIC_CHECKOUT_ENABLED=true
 * — one flag, no code changes. Everything behind it is built and tested.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const CHECKOUT_ENABLED = process.env.NEXT_PUBLIC_CHECKOUT_ENABLED === "true";
