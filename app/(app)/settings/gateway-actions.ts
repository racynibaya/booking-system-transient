"use server";

import { revalidatePath } from "next/cache";

import { env } from "@/env";
import { deleteWebhook, listWebhooks, registerWebhook } from "@/lib/paymongo/client";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";
import {
  deleteGatewayConnection,
  getGatewayConnection,
  storeGatewayConnection,
} from "@/lib/supabase/gateway-dal";

import type { ActionResult } from "./actions";

// Phase 2b / M2 — operator-as-merchant PayMongo connect/disconnect. This is the ONE place a tenant's
// plaintext secret key (sk_) is handled at the app layer: it arrives from the connect form, is used
// to talk to PayMongo, and is handed to the service-role DAL (storeGatewayConnection) which encrypts
// it into Vault. It is NEVER logged and NEVER returned to the client. The decrypting reader
// (getGatewayConnection) is used here only for disconnect cleanup, inside the service-role boundary.
//
// The plan='business' check is a soft/UX gate (see the tenant_plan migration): real protection is
// that a checkout (M4) needs a genuine stored connection, which needs a working PayMongo account.

// Our own webhook path prefix; used to recognise (and clean up) a webhook we previously registered
// on this account so a re-connect doesn't leave duplicates.
function webhookUrlFor(token: string): string {
  return `${env.SITE_URL}/api/webhooks/paymongo/${token}`;
}

export async function connectGateway(sk: string): Promise<ActionResult> {
  await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "No operator account found." };
  if (tenant.plan !== "business") {
    return { ok: false, error: "Online payments are a Business-plan feature." };
  }
  if (!env.SITE_URL) {
    return { ok: false, error: "Online payments aren't available on this deployment yet." };
  }

  const key = sk.trim();
  if (!key.startsWith("sk_")) {
    return { ok: false, error: "That doesn't look like a PayMongo secret key (sk_…)." };
  }

  try {
    // Authenticates the key (401 → caught below) and lets us spot a webhook we already registered.
    const existing = await listWebhooks(key);

    // Clean up any prior webhook of ours on THIS account (re-connect with the same account) so we
    // don't accumulate duplicates. A different account simply has none of ours — nothing to clean.
    const ourPrefix = `${env.SITE_URL}/api/webhooks/paymongo/`;
    for (const w of existing.filter((w) => w.url.startsWith(ourPrefix))) {
      try {
        await deleteWebhook(key, w.id);
      } catch {
        // Best-effort; a stale duplicate webhook is harmless (its token routes nowhere live).
      }
    }

    const webhookToken = crypto.randomUUID();
    const { id: webhookId, secretKey: whsk } = await registerWebhook(
      key,
      webhookUrlFor(webhookToken),
    );

    await storeGatewayConnection({
      tenantId: tenant.id,
      sk: key,
      whsk,
      webhookToken,
      webhookId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes(" 401")) {
      return { ok: false, error: "PayMongo didn't accept that secret key. Check and try again." };
    }
    return { ok: false, error: "Couldn't connect to PayMongo. Please try again." };
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function disconnectGateway(): Promise<ActionResult> {
  await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "No operator account found." };

  // Fetch the connection (service-role decrypt) BEFORE deleting it — we need the operator's sk_ to
  // remove the webhook on PayMongo's side, and that key is gone once the row + Vault secrets drop.
  const conn = await getGatewayConnection(tenant.id);
  if (!conn) {
    revalidatePath("/settings");
    return { ok: true }; // already disconnected — idempotent
  }

  if (conn.webhookId) {
    try {
      await deleteWebhook(conn.sk, conn.webhookId);
    } catch {
      // Best-effort: a leftover webhook on PayMongo is harmless once we stop honouring its events.
    }
  }

  await deleteGatewayConnection(tenant.id);
  revalidatePath("/settings");
  return { ok: true };
}
