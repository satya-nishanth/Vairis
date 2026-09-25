import type { Metadata } from "next";
import { PolicyPage } from "../PolicyPage";

export const metadata: Metadata = {
  title: "Refund & Return Policy",
  description:
    "Our 7-day hassle-free return and exchange policy for fine jewellery. Insured pickups, quality verification, and transparent refunds.",
};

export default function RefundPolicyPage() {
  return (
    <PolicyPage title="Refund & Return Policy" updated="25 September 2026">
      <h2>Returns</h2>
      <p>
        You may request a return within 7 days of delivery by reaching out to our
        concierge support via WhatsApp or email (hello@vairis.com) with your order ID.
        Once approved, we arrange an insured pickup at your address. After the
        piece passes our quality check (unworn, undamaged, with the original IGI
        certificate and packaging), your refund is initiated.
      </p>
      <h2>Cancellations</h2>
      <p>
        Orders can be cancelled free of charge any time before dispatch by contacting
        support or via WhatsApp. For paid orders, refunds are issued in full to the
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
