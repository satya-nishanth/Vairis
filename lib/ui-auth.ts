export type AuthChannel = "email" | "mobile";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeIdentifier(channel: AuthChannel, value: string): string {
  const trimmed = value.trim();
  if (channel === "email") return trimmed.toLowerCase();
  return trimmed.replace(/\D/g, "");
}

export function isValidIdentifier(channel: AuthChannel, value: string): boolean {
  const v = normalizeIdentifier(channel, value);
  if (channel === "email") return EMAIL_PATTERN.test(v);
  return v.length >= 10;
}
