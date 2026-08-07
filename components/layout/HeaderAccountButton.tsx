"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { IconAccount } from "@/components/icons";

export function HeaderAccountButton() {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (userEmail) {
    return (
      <Link href="/account" className="header-account-btn" aria-label={`Account: ${userEmail}`}>
        <IconAccount />
      </Link>
    );
  }

  return (
    <Link href="/auth/login" className="header-account-btn" aria-label="Sign in">
      <IconAccount />
    </Link>
  );
}
