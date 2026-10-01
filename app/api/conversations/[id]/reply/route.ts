import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendToConversation } from "@/lib/chat/notify";

const Body = z.object({ text: z.string().trim().min(1).max(2000) });

/** A staff reply from the inbox. Ownership is checked through RLS before sending with the service role. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireApiUser();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a message first" }, { status: 400 });

  const db = await createClient();
  const { data: owned, error } = await db.from("conversations").select("id").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load the chat" }, { status: 500 });
  if (!owned) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const result = await sendToConversation(id, [{ type: "text", text: parsed.data.text }], "staff");
  if (!result.sent) {
    const reason = {
      window_closed: "WhatsApp only allows replies within 24 hours of the customer's last message.",
      not_configured: "WhatsApp isn't connected yet (see Settings).",
      no_conversation: "Chat not found.",
      failed: "WhatsApp didn't accept the message. Try again.",
    }[result.reason];
    return NextResponse.json({ error: reason }, { status: result.reason === "no_conversation" ? 404 : 409 });
  }
  return NextResponse.json({ ok: true });
}
