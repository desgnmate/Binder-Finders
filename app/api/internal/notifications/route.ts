import { serviceClient } from "../../../../lib/supabase/server";
import { reconcileDueStripeAttempts } from "../../../../lib/stripe-reconciliation";
import {
  renderHoldNotification,
  type HoldNotificationKind,
  type HoldNotificationPayload,
} from "../../../../lib/notifications/hold-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`,
  );
}

async function processNotifications(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = serviceClient();
  let paymentReconciliation: { reconciled: number; errors: number };
  try {
    paymentReconciliation = await reconcileDueStripeAttempts(db);
  } catch {
    return Response.json({ error: "Payment reconciliation is unavailable" }, { status: 503 });
  }
  const { data: expired, error: expiryError } = await db.rpc("cms_expire_unpaid_holds", {
    p_limit: 50,
  });
  if (expiryError) {
    return Response.json({ error: "Hold expiry processing is unavailable" }, { status: 503 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return Response.json(
      { error: "Transactional email delivery is not configured", expired: expired || 0, paymentReconciliation },
      { status: 503 },
    );
  }
  const { data, error } = await db.rpc("cms_claim_notification_outbox", {
    p_limit: 5,
  });
  if (error) {
    return Response.json(
      { error: "Notification queue is unavailable" },
      { status: 503 },
    );
  }

  let sent = 0;
  let failed = 0;
  let acknowledgementFailed = 0;
  for (const row of data || []) {
    // Never send if an older database returned a row without a lease token.
    if (!row.claim_token) {
      failed += 1;
      continue;
    }
    let deliveryError: string | null = null;
    try {
      let body = row.delivery_body;
      if (!body) {
        const email = renderHoldNotification(
          row.kind as HoldNotificationKind,
          row.payload as HoldNotificationPayload,
        );
        const prepared = await db.rpc("cms_prepare_notification", {
          p_id: row.id,
          p_claim_token: row.claim_token,
          p_body: {
            from: process.env.RESEND_FROM_EMAIL,
            to: [row.to_email],
            subject: email.subject,
            html: email.html,
            text: email.text,
          },
        });
        if (prepared.error || !prepared.data) throw new Error("Could not prepare notification");
        body = prepared.data;
      }
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `binderfinders-notification-${row.id}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`Email provider returned ${response.status}`);
      }
    } catch (error) {
      deliveryError = error instanceof Error ? error.message : "Delivery failed";
    }
    try {
      const finished = await db.rpc("cms_finish_notification", {
        p_id: row.id,
        p_claim_token: row.claim_token,
        p_success: deliveryError === null,
        p_error: deliveryError,
      });
      if (finished.error || finished.data !== true) {
        // Leave an ambiguous acknowledgement for lease recovery. Retrying uses
        // the frozen request and provider key, not a new email delivery.
        acknowledgementFailed += 1;
      } else if (deliveryError) failed += 1;
      else sent += 1;
    } catch {
      acknowledgementFailed += 1;
    }
  }

  return Response.json(
    { expired: expired || 0, paymentReconciliation, claimed: (data || []).length, sent, failed, acknowledgementFailed },
    { status: failed || acknowledgementFailed || paymentReconciliation.errors ? 503 : 200 },
  );
}

export async function GET(request: Request) {
  return processNotifications(request);
}

export async function POST(request: Request) {
  return processNotifications(request);
}
