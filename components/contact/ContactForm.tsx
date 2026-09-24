"use client";

import { useState } from "react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const [refId, setRefId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setStatus("error");
      setErrorText("Please provide your name.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setStatus("error");
      setErrorText("Please provide an email or 10-digit phone number.");
      return;
    }
    if (phone.trim() && !/^\d{10}$/.test(phone.trim())) {
      setStatus("error");
      setErrorText("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!message.trim() || message.trim().length < 5) {
      setStatus("error");
      setErrorText("Please enter a message (at least 5 characters).");
      return;
    }

    setLoading(true);
    setStatus("idle");
    setErrorText("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit request.");
      }

      setStatus("success");
      setRefId(data.id || "");
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (err: unknown) {
      setStatus("error");
      setErrorText(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "success") {
    return (
      <div
        style={{
          padding: "32px",
          background: "var(--bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "2rem", marginBottom: "8px" }}>✨</p>
        <h3 style={{ fontSize: "1.25rem", marginBottom: "8px" }}>Message Received</h3>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>
          Thank you for reaching out. Our fine jewellery team will get back to you within 24 hours.
        </p>
        {refId && (
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Reference ID: <code>{refId}</code>
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: "32px",
        background: "var(--bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
      noValidate
    >
      <h3 style={{ fontSize: "1.25rem", marginBottom: "4px" }}>Send Us a Message</h3>
      <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "8px" }}>
        Have questions about custom pieces, bespoke orders, or sizing? Leave a note and we&apos;ll be in touch.
      </p>

      {status === "error" && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            borderRadius: "var(--radius-sm)",
            color: "#ef4444",
            fontSize: "0.875rem",
          }}
          role="alert"
        >
          {errorText}
        </div>
      )}

      <div>
        <label htmlFor="contact-name" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "6px" }}>
          Full Name *
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          required
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--bg-page)",
            color: "var(--color-text)",
            fontSize: "0.875rem",
          }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <label htmlFor="contact-email" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "6px" }}>
            Email Address
          </label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "var(--bg-page)",
              color: "var(--color-text)",
              fontSize: "0.875rem",
            }}
          />
        </div>

        <div>
          <label htmlFor="contact-phone" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "6px" }}>
            Mobile Number (India)
          </label>
          <input
            id="contact-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="10-digit number"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "var(--bg-page)",
              color: "var(--color-text)",
              fontSize: "0.875rem",
            }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "6px" }}>
          Message *
        </label>
        <textarea
          id="contact-message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can our jewellery consultants assist you?"
          required
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--bg-page)",
            color: "var(--color-text)",
            fontSize: "0.875rem",
            resize: "vertical",
          }}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary"
        style={{ alignSelf: "flex-start", marginTop: "8px" }}
      >
        {loading ? "Sending Message…" : "Send Message"}
      </button>
    </form>
  );
}
