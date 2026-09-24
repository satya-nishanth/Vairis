import type { Metadata } from "next";
import { PolicyPage } from "../PolicyPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the VAIRIS terms of service covering our certified diamond and gold jewellery, transparent pricing, ordering, payments, and warranties.",
};

export default function TermsPage() {
  return (
    <PolicyPage title="Terms of Service" updated="25 July 2026">
      <h2>Products & pricing</h2>
      <p>
        Every VAIRIS piece is described with its true gold weight, diamond type,
        clarity/color, and carat weight. For online checkout pieces, prices are
        computed from live gold rates, per-carat diamond rates, making charges,
        and GST, with a complete transparent breakdown shown prior to payment.
        For customized, bespoke, or &ldquo;Price on Request&rdquo; pieces, formal
        quotations are provided directly by our concierge team. Prices refresh with
        market rates; the price you pay is locked when your order or quotation is
        confirmed.
      </p>
      <h2>Certification</h2>
      <p>
        Diamonds are IGI certified and gold is BIS hallmarked. Official certificates
        accompany every piece upon delivery.
      </p>
      <h2>Orders & payment</h2>
      <p>
        Orders may be placed directly on our storefront or finalized via personalized
        quotations with our concierge team. Payments are processed securely through
        authorized payment gateways (Razorpay supporting UPI, credit/debit cards, and
        netbanking) or official bank transfer. An order is confirmed once payment
        is captured or verified.
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
