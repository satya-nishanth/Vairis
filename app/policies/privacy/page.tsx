import type { Metadata } from "next";
import { PolicyPage } from "../PolicyPage";

export const metadata: Metadata = { title: "Privacy Policy | VAIRIS" };

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage title="Privacy Policy" updated="25 July 2026">
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email, mobile number.</li>
        <li>Order details: delivery address, items purchased, payment status (we never see or store card/UPI credentials — payments are processed by Razorpay).</li>
        <li>Usage data: pages viewed, searches, and cart activity, used to improve the store.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To process and deliver your orders, send order updates, and handle returns and refunds.</li>
        <li>To respond to your messages and support requests.</li>
        <li>To understand what our customers love and improve the catalogue.</li>
      </ul>
      <h2>What we never do</h2>
      <ul>
        <li>We never sell your personal data.</li>
        <li>We never share it with third parties beyond what is needed to run the store (payment gateway, courier, email provider).</li>
      </ul>
      <h2>Cookies & analytics</h2>
      <p>
        We use first-party analytics and, where configured, Google Analytics to
        measure store performance. You can block cookies in your browser; the
        store keeps working.
      </p>
      <h2>Your rights</h2>
      <p>
        Write to us via the Contact page to access, correct, or delete the
        personal data we hold about you.
      </p>
    </PolicyPage>
  );
}
