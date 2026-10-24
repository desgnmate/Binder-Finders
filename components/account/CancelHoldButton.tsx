"use client";
import { useEffect, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { cancelCustomerHold } from "../../app/account/actions";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" className="ac-btn ac-btn--danger" disabled={pending}>{pending ? "Cancelling…" : "Cancel unpaid request"}</button>;
}

export function CancelHoldButton({ id }: { id: string }) {
  const router = useRouter();
  const [state, action] = useActionState(cancelCustomerHold, {} as { error?: string; success?: boolean });
  useEffect(() => { if (state.success) router.refresh(); }, [router, state.success]);
  if (state.success) return <p className="customer-message" role="status">Request cancelled.</p>;
  return <form action={action} className="customer-cancel-form">
    <input type="hidden" name="id" value={id} />
    <Submit />
    <small>Releases these cards back into the binder.</small>
    {state.error && <p className="customer-message" role="alert">{state.error}</p>}
  </form>;
}
