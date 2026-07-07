"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import {
  detectIdentifierChannel,
  isValidOtp,
  isValidUnifiedIdentifier,
  normalizeIdentifier,
  type AuthChannel,
  type AuthUser,
} from "@/lib/ui-auth";
import type { AuthMode } from "./AuthProvider";

type AuthPopoverProps = {
  mode: AuthMode;
  anchor: { top: number; left: number; width: number };
  onClose: () => void;
  onComplete: (user: AuthUser) => void;
  onSwitchMode: (mode: AuthMode) => void;
};

type Step = "identifier" | "otp" | "profile";

export function AuthPopover({ mode, anchor, onClose, onComplete, onSwitchMode }: AuthPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("identifier");
  const [channel, setChannel] = useState<AuthChannel | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    setStep("identifier");
    setIdentifier("");
    setOtp("");
    setFullName("");
    setBirthday("");
    setError(null);
    setOtpSent(false);
    setChannel(null);
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [onClose]);

  const [panelStyle, setPanelStyle] = useState<CSSProperties>({ top: anchor.top + 12, left: anchor.left });

  useEffect(() => {
    const left = Math.max(16, Math.min(anchor.left + anchor.width / 2 - 180, window.innerWidth - 376));
    setPanelStyle({ top: anchor.top + 12, left });
  }, [anchor]);

  function sendOtp(e?: FormEvent) {
    e?.preventDefault();
    const detected = detectIdentifierChannel(identifier);
    if (!detected || !isValidUnifiedIdentifier(identifier)) {
      setError("Enter a valid email address or 10-digit mobile number.");
      return;
    }
    setChannel(detected);
    setError(null);
    setOtpSent(true);
    setStep("otp");
  }

  function verifyOtp(e: FormEvent) {
    e.preventDefault();
    if (!isValidOtp(otp)) {
      setError("Enter the 6-digit code we sent you.");
      return;
    }
    setError(null);
    if (mode === "signup") {
      setStep("profile");
      return;
    }
    onComplete({
      id: `user-${Date.now()}`,
      channel: channel!,
      identifier: normalizeIdentifier(channel!, identifier),
      fullName: "",
      birthday: "",
    });
  }

  function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!birthday) {
      setError("Please select your birthday.");
      return;
    }
    setError(null);
    onComplete({
      id: `user-${Date.now()}`,
      channel: channel!,
      identifier: normalizeIdentifier(channel!, identifier),
      fullName: fullName.trim(),
      birthday,
    });
  }

  return (
    <>
      <div className="auth-popover__backdrop" aria-hidden />
      <div
        ref={panelRef}
        className="auth-popover"
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-popover-title"
      >
        <span
          className="auth-popover__caret"
          style={{
            left:
              typeof panelStyle.left === "number"
                ? anchor.left + anchor.width / 2 - panelStyle.left
                : anchor.width / 2,
          }}
        />
        <button type="button" className="auth-popover__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {step === "identifier" && (
          <>
            <h2 id="auth-popover-title" className="auth-popover__title">
              {mode === "signin" ? "Sign in" : "Create account"}
            </h2>
            <p className="auth-popover__lead">
              {mode === "signin"
                ? "Enter your email or mobile — we’ll send a one-time code to verify it’s you."
                : "Start with your email or mobile — we’ll verify with OTP."}
            </p>
            <form onSubmit={sendOtp}>
              <label className="auth-popover__label" htmlFor="auth-identifier">
                Email or mobile number
              </label>
              <input
                id="auth-identifier"
                className="auth-popover__input"
                type={identifier.includes("@") ? "email" : "tel"}
                inputMode={identifier.includes("@") ? "email" : "tel"}
                placeholder="you@example.com or 10-digit mobile"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
              {error && <p className="auth-popover__error">{error}</p>}
              <Button type="submit" variant="primary" className="auth-popover__submit">
                Send OTP
              </Button>
            </form>
            <p className="auth-popover__switch">
              {mode === "signin" ? (
                <>
                  New to VAIRIS?{" "}
                  <button type="button" onClick={() => onSwitchMode("signup")}>
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button type="button" onClick={() => onSwitchMode("signin")}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </>
        )}

        {step === "otp" && (
          <>
            <h2 id="auth-popover-title" className="auth-popover__title">
              Enter OTP
            </h2>
            <p className="auth-popover__lead">
              Code sent to {otpSent && channel ? normalizeIdentifier(channel, identifier) : "your contact"}.
              <button type="button" className="auth-popover__link" onClick={() => setStep("identifier")}>
                Change
              </button>
            </p>
            <form onSubmit={verifyOtp}>
              <label className="auth-popover__label" htmlFor="auth-otp">
                6-digit code
              </label>
              <input
                id="auth-otp"
                className="auth-popover__input auth-popover__input--otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoComplete="one-time-code"
              />
              {error && <p className="auth-popover__error">{error}</p>}
              <Button type="submit" variant="primary" className="auth-popover__submit">
                Verify &amp; continue
              </Button>
            </form>
            <button type="button" className="auth-popover__resend" onClick={() => sendOtp()}>
              Resend OTP
            </button>
          </>
        )}

        {step === "profile" && (
          <>
            <h2 id="auth-popover-title" className="auth-popover__title">
              Almost there
            </h2>
            <p className="auth-popover__lead">Tell us a little about you for a personalised experience.</p>
            <form onSubmit={saveProfile}>
              <label className="auth-popover__label" htmlFor="auth-name">
                Full name
              </label>
              <input
                id="auth-name"
                className="auth-popover__input"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
              <label className="auth-popover__label" htmlFor="auth-birthday">
                Birthday
              </label>
              <input
                id="auth-birthday"
                className="auth-popover__input"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
              {error && <p className="auth-popover__error">{error}</p>}
              <Button type="submit" variant="primary" className="auth-popover__submit">
                Complete sign up
              </Button>
            </form>
          </>
        )}
      </div>
    </>
  );
}
