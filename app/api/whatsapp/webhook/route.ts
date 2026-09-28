import { after, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { claimMessage, processMessage } from "@/lib/whatsapp/handle";
import { parseMessages, verifySignature } from "@/lib/whatsapp/webhook";

// PUBLIC (Meta calls it), authenticated by the X-Hub-Signature-256 HMAC.
// Configure in the Meta app: Callback URL https://<host>/api/whatsapp/webhook,
// Verify token = WHATSAPP_VERIFY_TOKEN, subscribe to the "messages" field.

// Download + speech-to-text + LLM + send runs in after(); give it room.
export const maxDuration = 60;

/** Meta's one-time subscription check. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = Buffer.from(params.get("hub.verify_token") ?? "");
  const expected = Buffer.from(process.env.WHATSAPP_VERIFY_TOKEN ?? "");
  const matches = expected.length > 0 && token.length === expected.length && timingSafeEqual(token, expected);
  if (params.get("hub.mode") === "subscribe" && matches) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = parseMessages(payload);
  try {
    for (const message of messages) {
      // Ignore retries of messages we've already taken, and anything older than a day.
      if (message.timestamp && Date.now() / 1000 - message.timestamp > 24 * 3600) continue;
      if (!(await claimMessage(message.id))) continue;
      after(() =>
        processMessage(message).catch((err) => console.error(`[whatsapp] processing ${message.id} failed`, err))
      );
    }
  } catch (err) {
    // 500 makes Meta retry later, which is what we want if the database is down.
    console.error("[POST /api/whatsapp/webhook]", err);
    return NextResponse.json({ error: "Temporarily unavailable" }, { status: 500 });
  }

  // Statuses (sent/delivered/read) and anything else: acknowledge so Meta doesn't retry.
  return NextResponse.json({ ok: true });
}
