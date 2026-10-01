import { createHmac, timingSafeEqual } from "node:crypto";

// Meta signs every webhook with the app secret: X-Hub-Signature-256 is
// "sha256=" + HMAC-SHA256(raw body). Same timing-safe check as the Twilio one
// in lib/voice/twilio.ts.
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"));
  const given = Buffer.from(header.slice("sha256=".length));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export type WhatsAppInbound =
  | { kind: "text"; text: string }
  | { kind: "audio"; mediaId: string; mimeType: string }
  | { kind: "button"; id: string; title: string }
  | { kind: "location"; text: string }
  | { kind: "unsupported"; type: string };

export interface WhatsAppMessage {
  phoneNumberId: string;
  from: string; // wa_id, digits only, e.g. 256772123456
  name: string | null;
  id: string; // wamid
  timestamp: number;
  content: WhatsAppInbound;
}

interface Payload {
  object?: string;
  entry?: {
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: RawMessage[];
      };
    }[];
  }[];
}

interface RawMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  audio?: { id?: string; mime_type?: string };
  interactive?: { type?: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  button?: { text?: string; payload?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
}

/** Customer messages in a webhook payload. Delivery/read statuses are ignored. */
export function parseMessages(payload: unknown): WhatsAppMessage[] {
  const p = payload as Payload;
  if (p?.object !== "whatsapp_business_account") return [];
  const out: WhatsAppMessage[] = [];
  for (const entry of p.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (change.field !== "messages" || !phoneNumberId) continue;
      for (const m of value?.messages ?? []) {
        const contact = value?.contacts?.find((c) => c.wa_id === m.from) ?? value?.contacts?.[0];
        out.push({
          phoneNumberId,
          from: m.from,
          name: contact?.profile?.name ?? null,
          id: m.id,
          timestamp: Number(m.timestamp) || 0,
          content: toContent(m),
        });
      }
    }
  }
  return out;
}

function toContent(m: RawMessage): WhatsAppInbound {
  switch (m.type) {
    case "text":
      return { kind: "text", text: m.text?.body ?? "" };
    case "audio":
      return m.audio?.id ? { kind: "audio", mediaId: m.audio.id, mimeType: m.audio.mime_type ?? "audio/ogg" } : { kind: "unsupported", type: "audio" };
    case "interactive": {
      const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
      return reply ? { kind: "button", id: reply.id, title: reply.title } : { kind: "unsupported", type: "interactive" };
    }
    case "button":
      return { kind: "button", id: m.button?.payload ?? "", title: m.button?.text ?? "" };
    case "location": {
      const l = m.location ?? {};
      const place = [l.name, l.address].filter(Boolean).join(", ");
      return { kind: "location", text: `[shared location] ${place || "pin"} (${l.latitude}, ${l.longitude})` };
    }
    default:
      return { kind: "unsupported", type: m.type };
  }
}
