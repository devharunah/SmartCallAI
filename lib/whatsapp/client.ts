import type { OutMessage } from "../chat/types";

// WhatsApp Cloud API over plain fetch (Meta archived its Node SDK in 2023).
// One access token for now: every restaurant on the demo shares our number.
// Per-restaurant tokens arrive with Embedded Signup (Tech Provider) later.

const GRAPH = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0"}`;

export function isWhatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN);
}

async function graph<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error("WHATSAPP_TOKEN is not set");
  const res = await fetch(`${GRAPH()}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`WhatsApp ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

function send(phoneNumberId: string, to: string, message: Record<string, unknown>) {
  return graph<{ messages: { id: string }[] }>(`${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...message }),
  });
}

/** Image links must be absolute and public: WhatsApp's servers fetch them. */
function absolute(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("PUBLIC_BASE_URL is needed to send menu images over WhatsApp");
  return `${base}${url}`;
}

export async function sendOut(phoneNumberId: string, to: string, messages: OutMessage[]) {
  // In order, one at a time: WhatsApp doesn't guarantee order for parallel sends.
  for (const m of messages) {
    if (m.type === "text") {
      await send(phoneNumberId, to, { type: "text", text: { body: m.text.slice(0, 4096), preview_url: false } });
    } else if (m.type === "image") {
      await send(phoneNumberId, to, { type: "image", image: { link: absolute(m.url), ...(m.caption && { caption: m.caption.slice(0, 1024) }) } });
    } else {
      await send(phoneNumberId, to, {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: m.text.slice(0, 1024) },
          action: {
            buttons: m.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })),
          },
        },
      });
    }
  }
}

/** Blue ticks plus the "typing…" indicator while the AI works (it clears on our reply or after ~25s). */
export async function markReadTyping(phoneNumberId: string, messageId: string) {
  await graph(`${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId, typing_indicator: { type: "text" } }),
  });
}

/** Voice notes arrive as a media id; the download URL expires after 5 minutes and needs the token. */
export async function downloadMedia(mediaId: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const meta = await graph<{ url: string; mime_type: string }>(mediaId, { method: "GET" });
  const res = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`WhatsApp media download ${res.status}`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType: meta.mime_type };
}
