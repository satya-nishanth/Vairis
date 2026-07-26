import type { Metadata } from "next";
import { PolicyPage } from "../PolicyPage";

export const metadata: Metadata = { title: "Refund & Return Policy | VAIRIS" };

export default function RefundPolicyPage() {
  return (
    <PolicyPage title="Refund & Return Policy" updated="25 July 2026">
      <h2>Returns</h2>
      <p>
        You may request a return within 7 days of delivery from your order page
        (My Orders → Not Quite Right? → Request Return). Once we approve the
        request, we arrange an insured pickup. After the piece passes our
        quality check (unworn, undamaged, with the original certificate and
        packaging), your refund is initiated.
      </p>
      <h2>Cancellations</h2>
      <p>
        Orders can be cancelled free of charge any time before dispatch from
        your order page. Paid orders are refunded in full automatically to the
        original payment method.
      </p>
      <h2>Refund timelines</h2>
      <ul>
        <li>Refund initiated: within 2 business days of QC pass or cancellation.</li>
        <li>Amount credited: 5–7 business days depending on your bank (via Razorpay).</li>
      </ul>
      <h2>Damaged or incorrect items</h2>
      <p>
        If your piece arrives damaged or is not what you ordered, contact us
        within 48 hours of delivery with photos — we will replace it or refund
        you in full, including shipping.
      </p>
      <h2>Exchange-priced diamonds</h2>
      <p>
        Pieces purchased at the with-exchange diamond rate qualify for
        full-value exchange of the diamond value against a future VAIRIS
        purchase, as stated on the product page at the time of purchase.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about a refund? Reach us via the Contact page or WhatsApp —
        every refund is tracked and visible on your order page.
      </p>
    </PolicyPage>
  );
}
