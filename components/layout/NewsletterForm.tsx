"use client";

import { useState } from "react";
import { IconChevronRight } from "@/components/icons/ThemeIcon";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setStatus("error");
      setErrorMessage("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setStatus("idle");
    setErrorMessage("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to subscribe. Please try again.");
      }

      setStatus("success");
      setEmail("");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "success") {
    return (
      <div className="newsletter-success" style={{ color: "var(--color-primary, #b78a3c)", fontSize: "0.875rem", marginTop: "12px", fontWeight: 500 }}>
        ✓ You&apos;re on the list! Welcome to VAIRIS.
      </div>
    );
  }

  return (
    <form className="newsletter-form" onSubmit={handleSubmit} noValidate>
      <div style={{ display: "flex", width: "100%", position: "relative" }}>
        <input
          type="email"
          placeholder="Enter your email"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          disabled={loading}
          required
        />
        <button type="submit" aria-label="Subscribe to newsletter" disabled={loading}>
          {loading ? "…" : <IconChevronRight />}
        </button>
      </div>
      {status === "error" && (
        <p style={{ color: "var(--color-error, #ef4444)", fontSize: "0.75rem", marginTop: "6px" }} role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
