import "server-only";
import webpush from "web-push";
import { createAdminClient } from "./supabase-admin";

export interface PushPayload {
  title: string;
  body?: string;
  link?: string;
}

let configured = false;

function setup(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails("mailto:nao-responder@corpservices", pub, priv);
    configured = true;
  }
  return true;
}

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** Envia push a todas as inscrições do usuário; remove expiradas (410). Best-effort. */
export async function sendPushToUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; dropped: number }> {
  if (!setup()) return { sent: 0, dropped: 0 };
  const { data } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let sent = 0;
  let dropped = 0;
  for (const s of data ?? []) {
    const sub = s as { id: string; endpoint: string; p256dh: string; auth: string };
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        dropped += 1;
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
  return { sent, dropped };
}
