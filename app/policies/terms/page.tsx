import type { Metadata } from "next";
import { PolicyPage } from "../PolicyPage";

export const metadata: Metadata = { title: "Terms of Service | VAIRIS" };

export default function TermsPage() {
  return (
    <PolicyPage title="Terms of Service" updated="25 July 2026">
      <h2>Products & pricing</h2>
      <p>
        Every VAIRIS piece is described with its true gold weight, diamond type
        and carat weight. Prices are computed from live gold rates, per-carat
        diamond rates, making charges, a disclosed Value Addition line and GST
        — the full breakup is shown on each product page and at checkout.
        Prices refresh with market rates; the price you pay is locked when your
        order is placed.
      </p>
      <h2>Certification</h2>
      <p>
        Diamonds are IGI certified and gold is BIS hallmarked. Certificates
        accompany the piece.
      </p>
      <h2>Orders & payment</h2>
      <p>
        Payment is processed securely by Razorpay (UPI, cards, netbanking). An
        order is confirmed when payment is captured. Unpaid orders expire
        automatically after 24 hours.
      </p>
      <h2>Shipping, returns & refunds</h2>
      <p>
        See our <a href="/policies/shipping">Shipping Policy</a> and{" "}
        <a href="/policies/refund">Refund &amp; Return Policy</a>.
      </p>
      <h2>Accounts</h2>
      <p>
        You are responsible for the accuracy of your account details and
        delivery address. We may suspend accounts used fraudulently.
      </p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India.</p>
    </PolicyPage>
  );
}
