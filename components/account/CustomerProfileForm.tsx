"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { saveCustomerProfile } from "../../app/account/actions";
export function CustomerProfileForm({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean }>({});
  return <form className="ac-form" onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    const data = new FormData(e.currentTarget); setBusy(true); setResult({});
    try { setResult(await saveCustomerProfile(data)); }
    catch { setResult({ error: "Connection interrupted. Please try again." }); }
    finally { setBusy(false); }
  }}><label>Your name<input name="name" autoComplete="name" defaultValue={name} required maxLength={120} /></label>
    {result.error && <p className="ac-status ac-status--error" role="alert">{result.error}</p>}
    {result.success && <p className="ac-status" role="status"><Check size={18} strokeWidth={3} color="#0b7a55" aria-hidden="true" />Profile saved.</p>}
    <button className="ac-btn ac-btn--yellow" style={{ alignSelf: "flex-start" }} disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></form>;
}
