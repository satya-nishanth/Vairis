import type { Metadata } from "next";
import { PolicyPage } from "../PolicyPage";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description:
    "Learn about free insured shipping across India with tamper-proof packaging and OTP-verified delivery from VAIRIS.",
};

export default function ShippingPolicyPage() {
  return (
    <PolicyPage title="Shipping Policy" updated="25 September 2026">
      <h2>Coverage & cost</h2>
      <p>
        We ship across India. Shipping is free on every order — no minimums.
      </p>
      <h2>Insured, tamper-proof delivery</h2>
      <p>
        Every VAIRIS shipment is fully insured in transit and packed in
        tamper-evident packaging. Deliveries are OTP-protected: the courier
        hands over the package only after identity confirmation.
      </p>
      <h2>Timelines</h2>
      <ul>
        <li>Dispatch: 2–7 business days depending on the piece (made-to-order items take longer — noted on the product page).</li>
        <li>Delivery: 2–5 business days after dispatch for most pincodes.</li>
      </ul>
      <h2>Tracking</h2>
      <p>
        You receive the courier and AWB number as soon as your order ships —
        track it any time from My Orders or the public Track Order page.
      </p>
      <h2>Failed deliveries</h2>
      <p>
        If a delivery attempt fails, the courier retries. If the package
        returns to us, we contact you to re-dispatch or refund.
      </p>
    </PolicyPage>
  );
}
