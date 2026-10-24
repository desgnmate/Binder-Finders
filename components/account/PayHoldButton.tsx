"use client";

import { useRef, useState } from "react";

export function PayHoldButton({ id, enabled = true }: { id: string; enabled?: boolean }) {
  const key = useRef<string | null>(null);
  if (!key.current) key.current = crypto.randomUUID();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startPayment() {
    if (busy || !enabled) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdId: id, idempotencyKey: key.current }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) {
        // A reported failure is safe to retry as a new attempt. In particular,
        // Stripe must not reuse the idempotency key of an expired Checkout session.
        key.current = crypto.randomUUID();
        setError(result.error || "Unable to start payment. Please try again.");
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError("Connection interrupted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="customer-payment-action">
    <button type="button" onClick={() => void startPayment()} disabled={busy || !enabled}>
      {!enabled ? "Online payments coming soon" : busy ? "Opening secure checkout…" : "Pay securely with Stripe"}
    </button>
    <small>{enabled ? "Card payments are processed securely by Stripe." : "The store is preparing secure online payments. Your accepted hold remains available."}</small>
    {error && <p className="customer-message" role="alert">{error}</p>}
  </div>;
}
