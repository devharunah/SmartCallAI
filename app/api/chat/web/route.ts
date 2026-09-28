import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getClaims } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getRestaurantBy } from "@/lib/restaurants/data";
import type { Language } from "@/lib/restaurants/types";
import { handleInbound } from "@/lib/chat/engine";
import { transcribeVoiceNote } from "@/lib/chat/transcribe";
import type { Inbound } from "@/lib/chat/types";

// PUBLIC for the demo restaurant: the /try simulator, a WhatsApp look-alike
// that runs the same engine as the real webhook. Any other restaurant is only
// reachable by its signed-in owner (the dashboard's "Test your bot" panel), so
// strangers can't put orders on a real restaurant's board.

const DEMO_SLUG = process.env.DEMO_RESTAURANT_SLUG ?? "mama-rose-kitchen";
const SESSION_ID = /^web_[0-9a-f-]{36}$/;
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

const Fields = z.object({
  sessionId: z.string().regex(SESSION_ID),
  restaurant: z.string().regex(/^[a-z0-9-]{1,80}$/).default(DEMO_SLUG),
  text: z.string().max(1000).optional(),
  buttonId: z.string().max(64).optional(),
  language: z.enum(["lug", "eng"]).optional(),
  name: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  if (!rateLimit(`chat-web:${clientIp(request)}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many messages, try again in a few minutes" }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected form data" }, { status: 400 });
  const parsed = Fields.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  const { sessionId, text, buttonId, name } = parsed.data;
  const audio = form.get("audio");
  if (audio !== null && (!(audio instanceof Blob) || audio.size > MAX_AUDIO_BYTES)) {
    return NextResponse.json({ error: "Voice note missing or larger than 3 MB" }, { status: 400 });
  }
  if (!audio && !text?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  try {
    const restaurant = await getRestaurantBy(supabase, "slug", parsed.data.restaurant);
    if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    if (restaurant.slug !== DEMO_SLUG) {
      const claims = await getClaims();
      if (!claims || claims.sub !== restaurant.ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const language: Language = parsed.data.language ?? restaurant.defaultLanguage;

    let inbound: Inbound;
    let transcriptProvider: string | null = null;
    if (audio instanceof Blob) {
      const result = await transcribeVoiceNote(new Uint8Array(await audio.arrayBuffer()), audio.type || "audio/webm", language);
      transcriptProvider = result.provider;
      inbound = { kind: "voice", text: result.text };
    } else if (buttonId) {
      inbound = { kind: "button", text: text ?? "", buttonId };
    } else {
      inbound = { kind: "text", text: text!.trim() };
    }

    const result = await handleInbound({
      restaurant: { ...restaurant, defaultLanguage: language },
      channel: "web",
      customerId: sessionId,
      customerName: name ?? null,
      inbound,
    });
    return NextResponse.json({
      transcript: inbound.kind === "voice" ? inbound.text : null,
      transcriptProvider,
      out: result.out,
      orderReference: result.orderReference,
      handoff: result.handoff,
    });
  } catch (err) {
    console.error("[POST /api/chat/web]", err);
    return NextResponse.json({ error: "Something went wrong on our side" }, { status: 500 });
  }
}
