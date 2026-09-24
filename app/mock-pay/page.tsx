import { notFound } from "next/navigation";
import { isMockPayAllowed } from "@/lib/payments/mock-guard";
import { MockPayClient } from "./MockPayClient";

export const dynamic = "force-dynamic";

export default function MockPayPage() {
  if (!isMockPayAllowed()) {
    notFound();
  }

  return <MockPayClient />;
}
