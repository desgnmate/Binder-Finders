"use client";
import { useState } from "react";
import { saveCustomerProfile } from "../../app/account/actions";
export function CustomerProfileForm({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean }>({});
  return <form onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    const data = new FormData(e.currentTarget); setBusy(true); setResult({});
    try { setResult(await saveCustomerProfile(data)); }
    catch { setResult({ error: "Connection interrupted. Please try again." }); }
    finally { setBusy(false); }
  }}><label>Your name<input name="name" autoComplete="name" defaultValue={name} required maxLength={120} /></label>
    {result.error && <p role="alert">{result.error}</p>}{result.success && <p role="status">Profile saved.</p>}
    <button disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></form>;
}
