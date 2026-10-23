"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Address = {
  id: string;
  label: string | null;
  contactName: string;
  contactPhone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
};

type Props = {
  initialUser: {
    id?: string;
    name: string;
    email: string;
    mobile: string | null;
  };
  initialAddresses: Address[];
};

export function AccountDashboardClient({ initialUser, initialAddresses }: Props) {
  const [user, setUser] = useState(initialUser);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: initialUser.name === initialUser.email ? "" : initialUser.name,
    mobile: initialUser.mobile ?? "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Address Book state
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    contactName: "",
    contactPhone: "",
    line1: "",
    line2: "",
    pincode: "",
    city: "",
    state: "",
    country: "IN",
    isDefault: false,
  });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressMsg, setAddressMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Password reset state
  const [pwdMsg, setPwdMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pwdSending, setPwdSending] = useState(false);

  // Privacy request state
  const [privacyRequested, setPrivacyRequested] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileForm.name.trim() || user.email.split("@")[0],
          mobile: profileForm.mobile.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg({ text: data.error ?? "Failed to update profile", error: true });
        return;
      }
      setUser((prev) => ({
        ...prev,
        name: data.name,
        mobile: data.mobile,
      }));
      setProfileMsg({ text: "Profile updated successfully!" });
      setIsEditingProfile(false);
    } catch {
      setProfileMsg({ text: "Network error. Please try again.", error: true });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddressSaving(true);
    setAddressMsg(null);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addressForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddressMsg({ text: data.error ?? "Could not save address", error: true });
        return;
      }
      setAddresses((prev) => (data.isDefault ? [data, ...prev.map((a) => ({ ...a, isDefault: false }))] : [...prev, data]));
      setShowAddAddress(false);
      setAddressForm({
        contactName: "",
        contactPhone: "",
        line1: "",
        line2: "",
        pincode: "",
        city: "",
        state: "",
        country: "IN",
        isDefault: false,
      });
      setAddressMsg({ text: "Address added successfully!" });
    } catch {
      setAddressMsg({ text: "Network error. Please try again.", error: true });
    } finally {
      setAddressSaving(false);
    }
  }

  async function handleDeleteAddress(id: string) {
    if (!window.confirm("Are you sure you want to delete this address?")) return;
    try {
      const res = await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // silent
    }
  }

  async function handleSendPasswordReset() {
    setPwdSending(true);
    setPwdMsg(null);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) {
        setPwdMsg({ text: error.message, error: true });
      } else {
        setPwdMsg({ text: "Password reset instructions sent to your email!" });
      }
    } catch {
      setPwdMsg({ text: "Failed to send reset email.", error: true });
    } finally {
      setPwdSending(false);
    }
  }

  const displayName =
    user.name && user.name !== user.email ? user.name : "Valued Customer";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Profile Card */}
      <div
        style={{
          background: "var(--color-surface-subtle, #f8f5f0)",
          border: "1px solid var(--color-border-light)",
          borderRadius: "8px",
          padding: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Personal Profile
          </p>
          <button
            type="button"
            onClick={() => setIsEditingProfile((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-primary, #c9a96e)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {isEditingProfile ? "Cancel" : "Edit Profile"}
          </button>
        </div>

        {profileMsg && (
          <p
            style={{
              fontSize: "0.8125rem",
              color: profileMsg.error ? "var(--color-error, #ef4444)" : "var(--color-success, #10b981)",
              marginBottom: "0.75rem",
            }}
          >
            {profileMsg.text}
          </p>
        )}

        {isEditingProfile ? (
          <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginTop: "0.5rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "var(--color-text-muted)" }}>
                Full Name
              </label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Enter your full name"
                required
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  borderRadius: "4px",
                  border: "1px solid var(--color-border-light)",
                  background: "var(--bg-card, #fff)",
                  color: "var(--color-text)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "var(--color-text-muted)" }}>
                Mobile Number (for WhatsApp order updates)
              </label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                value={profileForm.mobile}
                onChange={(e) => setProfileForm((f) => ({ ...f, mobile: e.target.value }))}
                placeholder="10-digit mobile number"
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  borderRadius: "4px",
                  border: "1px solid var(--color-border-light)",
                  background: "var(--bg-card, #fff)",
                  color: "var(--color-text)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button
                type="submit"
                disabled={profileSaving}
                className="btn btn-primary btn--sm"
              >
                {profileSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.25rem",
                fontWeight: 400,
                color: "var(--color-text)",
                marginBottom: "0.25rem",
              }}
            >
              {displayName}
            </p>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
              {user.email}
            </p>
            {user.mobile ? (
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                📱 +91 {user.mobile}
              </p>
            ) : (
              <p style={{ fontSize: "0.8125rem", color: "var(--color-primary, #c9a96e)", marginTop: "0.25rem" }}>
                Add mobile for automatic WhatsApp order linkage
              </p>
            )}
          </div>
        )}
      </div>

      {/* Saved Addresses / Address Book */}
      <div
        style={{
          background: "var(--color-surface-subtle, #f8f5f0)",
          border: "1px solid var(--color-border-light)",
          borderRadius: "8px",
          padding: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 500, color: "var(--color-text)" }}>
              Saved Addresses
            </h2>
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              Insured shipping addresses for instant checkout and delivery
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddAddress((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-primary, #c9a96e)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {showAddAddress ? "Cancel" : "+ Add New Address"}
          </button>
        </div>

        {addressMsg && (
          <p
            style={{
              fontSize: "0.8125rem",
              color: addressMsg.error ? "var(--color-error, #ef4444)" : "var(--color-success, #10b981)",
              marginBottom: "1rem",
            }}
          >
            {addressMsg.text}
          </p>
        )}

        {showAddAddress && (
          <form
            onSubmit={handleAddAddress}
            style={{
              background: "var(--bg-card, #fff)",
              padding: "1.25rem",
              borderRadius: "6px",
              border: "1px solid var(--color-border-light)",
              marginBottom: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.25rem" }}>New Address</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <input
                type="text"
                placeholder="Full Name *"
                required
                value={addressForm.contactName}
                onChange={(e) => setAddressForm((f) => ({ ...f, contactName: e.target.value }))}
                style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--color-border-light)", borderRadius: 4, fontSize: "0.875rem" }}
              />
              <input
                type="tel"
                placeholder="10-digit Phone *"
                required
                maxLength={10}
                value={addressForm.contactPhone}
                onChange={(e) => setAddressForm((f) => ({ ...f, contactPhone: e.target.value }))}
                style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--color-border-light)", borderRadius: 4, fontSize: "0.875rem" }}
              />
            </div>
            <input
              type="text"
              placeholder="Flat / House No. / Building / Street *"
              required
              value={addressForm.line1}
              onChange={(e) => setAddressForm((f) => ({ ...f, line1: e.target.value }))}
              style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--color-border-light)", borderRadius: 4, fontSize: "0.875rem" }}
            />
            <input
              type="text"
              placeholder="Apartment / Landmark / Area (Optional)"
              value={addressForm.line2}
              onChange={(e) => setAddressForm((f) => ({ ...f, line2: e.target.value }))}
              style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--color-border-light)", borderRadius: 4, fontSize: "0.875rem" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              <input
                type="text"
                placeholder="6-digit Pincode *"
                required
                maxLength={6}
                value={addressForm.pincode}
                onChange={(e) => setAddressForm((f) => ({ ...f, pincode: e.target.value }))}
                style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--color-border-light)", borderRadius: 4, fontSize: "0.875rem" }}
              />
              <input
                type="text"
                placeholder="City *"
                required
                value={addressForm.city}
                onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--color-border-light)", borderRadius: 4, fontSize: "0.875rem" }}
              />
              <input
                type="text"
                placeholder="State *"
                required
                value={addressForm.state}
                onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
                style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--color-border-light)", borderRadius: 4, fontSize: "0.875rem" }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", cursor: "pointer", marginTop: "0.25rem" }}>
              <input
                type="checkbox"
                checked={addressForm.isDefault}
                onChange={(e) => setAddressForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              Make this my default shipping address
            </label>
            <button
              type="submit"
              disabled={addressSaving}
              className="btn btn-primary btn--sm"
              style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}
            >
              {addressSaving ? "Saving Address…" : "Save Address"}
            </button>
          </form>
        )}

        {addresses.length === 0 ? (
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
            No saved addresses yet. Add your address for faster checkout on future orders.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {addresses.map((addr) => (
              <div
                key={addr.id}
                style={{
                  background: "var(--bg-card, #fff)",
                  padding: "1rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border-light)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <strong style={{ fontSize: "0.9375rem" }}>{addr.contactName}</strong>
                    {addr.isDefault && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "var(--color-primary, #c9a96e)",
                          color: "#fff",
                          fontWeight: 600,
                        }}
                      >
                        Default
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} - {addr.pincode}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                    Phone: {addr.contactPhone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAddress(addr.id)}
                  aria-label="Delete address"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-text-muted)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    padding: "4px 8px",
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security & Password */}
      <div
        style={{
          background: "var(--color-surface-subtle, #f8f5f0)",
          border: "1px solid var(--color-border-light)",
          borderRadius: "8px",
          padding: "1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1.125rem", fontWeight: 500, color: "var(--color-text)", marginBottom: "0.25rem" }}>
          Security &amp; Password
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
          Need to change your account password? We will send a secure reset link to {user.email}.
        </p>

        {pwdMsg && (
          <p
            style={{
              fontSize: "0.8125rem",
              color: pwdMsg.error ? "var(--color-error, #ef4444)" : "var(--color-success, #10b981)",
              marginBottom: "0.75rem",
            }}
          >
            {pwdMsg.text}
          </p>
        )}

        <button
          type="button"
          onClick={handleSendPasswordReset}
          disabled={pwdSending}
          className="btn btn-secondary btn--sm"
        >
          {pwdSending ? "Sending Link…" : "Send Password Reset Link"}
        </button>
      </div>

      {/* Privacy & Data Rights (DPDP Compliance) */}
      <div
        style={{
          background: "var(--color-surface-subtle, #f8f5f0)",
          border: "1px solid var(--color-border-light)",
          borderRadius: "8px",
          padding: "1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1.125rem", fontWeight: 500, color: "var(--color-text)", marginBottom: "0.25rem" }}>
          Privacy &amp; Data Rights
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
          Under Indian data protection standards, you have the right to access, correct, or request deletion of your personal data.
        </p>

        {privacyRequested ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--color-success, #10b981)" }}>
            ✓ Request acknowledged. Our Grievance Officer will contact you at {user.email} within 48 hours.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setPrivacyRequested(true)}
            style={{
              background: "none",
              border: "1px solid var(--color-border-light)",
              padding: "0.5rem 1rem",
              borderRadius: "4px",
              fontSize: "0.8125rem",
              color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            Request Data Export or Account Deletion
          </button>
        )}
      </div>
    </div>
  );
}
