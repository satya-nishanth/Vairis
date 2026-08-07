"use client";

import { useState } from "react";

export function CopyOrderButton({ orderId }: { orderId: string }) {
  const [label, setLabel] = useState("Copy");

  return (
    <button
      type="button"
      className="confirm-copy-btn"
      onClick={() => {
        navigator.clipboard.writeText(orderId).then(() => {
          setLabel("Copied!");
          setTimeout(() => setLabel("Copy"), 2000);
        });
      }}
    >
      {label}
    </button>
  );
}
