export type AuthChannel = "email" | "mobile";

export type AuthUser = {
  id: string;
  channel: AuthChannel;
  identifier: string;
  fullName: string;
  birthday: string;
};

export const AUTH_STORAGE_KEY = "vairis-auth-user";

export function loadStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveStoredUser(user: AuthUser | null): void {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

/** Wireframe: any 6-digit OTP succeeds; demo code 123456 */
export function isValidOtp(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function detectIdentifierChannel(value: string): AuthChannel | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return "email";
  return "mobile";
}

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

export function isValidUnifiedIdentifier(value: string): boolean {
  const channel = detectIdentifierChannel(value);
  if (!channel) return false;
  return isValidIdentifier(channel, value);
}
