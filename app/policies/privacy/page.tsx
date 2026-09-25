import type { Metadata } from "next";
import { PolicyPage } from "../PolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how VAIRIS collects, uses, and safeguards your personal data in accordance with the IT Act and Indian DPDP regulations.",
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage title="Privacy Policy" updated="25 September 2026">
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
        We use first-party analytics and privacy-respecting performance telemetry to
        measure site performance and improve user experience. We do not engage in
        cross-site behavioral tracking or sell user data. You can manage or block cookies
        through your browser settings at any time without impacting essential store features.
      </p>
      <h2>Your rights</h2>
      <p>
        Under applicable Indian data protection laws, including the Digital Personal
        Data Protection Act (DPDPA), you have the right to request access to, correction of,
        or deletion of your personal data. Contact us at hello@vairis.com to exercise these rights.
      </p>
      <h2>Grievance Officer & Indian Compliance</h2>
      <p>
        In accordance with the Information Technology Act, 2000 and the rules made thereunder:
      </p>
      <p>
        <strong>Name / Designation:</strong> Grievance Officer, VAIRIS Fine Jewellery<br />
        <strong>Email:</strong> grievance@vairis.com (cc: hello@vairis.com)<br />
        <strong>Registered Location:</strong> Mumbai, Maharashtra, India<br />
        <strong>Response Time:</strong> We acknowledge complaints within 48 hours and resolve them within 30 days.
      </p>
    </PolicyPage>
  );
}
