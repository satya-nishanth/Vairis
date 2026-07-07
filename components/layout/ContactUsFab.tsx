"use client";

import { useEffect, useId, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { isValidIdentifier, type AuthUser } from "@/lib/ui-auth";

type ContactUsFabProps = {
  label?: string;
};

function contactDefaults(user: AuthUser | null) {
  return {
    email: user?.channel === "email" ? user.identifier : "",
    mobile: user?.channel === "mobile" ? user.identifier : "",
  };
}

export function ContactUsFab({ label = "Contact us" }: ContactUsFabProps) {
  const titleId = useId();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const defaults = contactDefaults(user);
    setEmail(defaults.email);
    setMobile(defaults.mobile);
  }, [open, user]);

  const close = () => {
    setOpen(false);
    setSubmitted(false);
    setError("");
  };

  const openForm = () => {
    setTitle("");
    setDescription("");
    setError("");
    setSubmitted(false);
    setOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    if (!description.trim()) {
      setError("Please enter a description.");
      return;
    }
    if (!isValidIdentifier("mobile", mobile)) {
      setError("Please enter a valid mobile number.");
      return;
    }
    if (email.trim() && !isValidIdentifier("email", email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setSubmitted(true);
  };

  return (
    <>
      <button type="button" className="contact-us-fab" onClick={openForm}>
        {label}
      </button>

      <div
        className={open ? "modal-overlay is-open" : "modal-overlay"}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="modal modal--contact" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button type="button" className="modal--contact__close" onClick={close} aria-label="Close">
            ×
          </button>

          {submitted ? (
            <>
              <div className="modal__icon" aria-hidden>
                ✓
              </div>
              <h2 id={titleId} className="modal--contact__title">
                Message sent
              </h2>
              <p className="modal--contact__lead">Our team will get back to you shortly.</p>
              <Button type="button" variant="primary" full onClick={close}>
                Done
              </Button>
            </>
          ) : (
            <>
              <h2 id={titleId} className="modal--contact__title">
                Contact us
              </h2>
              <p className="modal--contact__lead">Share your question and we&apos;ll respond soon.</p>
              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="contact-title">Title</label>
                  <input
                    id="contact-title"
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="How can we help?"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="contact-description">Description</label>
                  <textarea
                    id="contact-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Tell us more about your request"
                    rows={4}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="contact-email">
                    Email <span className="form-group__optional">(optional)</span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="contact-mobile">Mobile</label>
                  <input
                    id="contact-mobile"
                    type="tel"
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value)}
                    placeholder="10-digit mobile number"
                    autoComplete="tel"
                    required
                  />
                </div>
                {error && <p className="contact-form__error">{error}</p>}
                <Button type="submit" variant="primary" full>
                  Submit
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
