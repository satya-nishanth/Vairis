"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loadStoredUser,
  saveStoredUser,
  type AuthChannel,
  type AuthUser,
} from "@/lib/ui-auth";
import { AuthPopover } from "./AuthPopover";

export type AuthMode = "signin" | "signup";

type AuthAnchor = { top: number; left: number; width: number };

type AuthContextValue = {
  user: AuthUser | null;
  openAuth: (mode: AuthMode, anchor: AuthAnchor) => void;
  closeAuth: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [anchor, setAnchor] = useState<AuthAnchor | null>(null);

  useEffect(() => {
    setUser(loadStoredUser());
  }, []);

  const closeAuth = useCallback(() => {
    setOpen(false);
    setAnchor(null);
  }, []);

  const openAuth = useCallback((nextMode: AuthMode, nextAnchor: AuthAnchor) => {
    setMode(nextMode);
    setAnchor(nextAnchor);
    setOpen(true);
  }, []);

  const signOut = useCallback(() => {
    saveStoredUser(null);
    setUser(null);
    closeAuth();
  }, [closeAuth]);

  const completeAuth = useCallback((nextUser: AuthUser) => {
    saveStoredUser(nextUser);
    setUser(nextUser);
    closeAuth();
  }, [closeAuth]);

  const value = useMemo(
    () => ({ user, openAuth, closeAuth, signOut }),
    [user, openAuth, closeAuth, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {open && anchor && (
        <AuthPopover
          mode={mode}
          anchor={anchor}
          onClose={closeAuth}
          onComplete={completeAuth}
          onSwitchMode={(m) => setMode(m)}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
