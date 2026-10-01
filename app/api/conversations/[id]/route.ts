import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({ aiPaused: z.boolean() });

/** Take over a chat from the AI, or hand it back. RLS limits it to the owner's conversations. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireApiUser();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const db = await createClient();
  const patch = parsed.data.aiPaused
    ? { ai_paused: true, status: "handoff" }
    : // Handing back: start the bot fresh from the top of the workflow.
      { ai_paused: false, status: "active", current_node: null, misses: 0 };
  const { data, error } = await db
    .from("conversations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, ai_paused, status")
    .maybeSingle();
  if (error) {
    console.error("[PATCH /api/conversations]", error);
    return NextResponse.json({ error: "Could not update the chat" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  return NextResponse.json(data);
}
