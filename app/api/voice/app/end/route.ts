import { after, NextResponse } from "next/server";
import { finishSession } from "@/lib/voice/sessions";

const SESSION_ID = /^app_[0-9a-f-]{36}$/;

// PUBLIC: the in-app caller hung up (or the call ended). Writes the calls row later.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { sessionId?: unknown; durationSeconds?: unknown } | null;
  const sessionId = body?.sessionId;
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }
  const duration = typeof body?.durationSeconds === "number" ? Math.max(0, Math.round(body.durationSeconds)) : null;

  after(() => finishSession(sessionId, duration, "app").catch((err) => console.error("[voice/app/end]", err)));
  return new NextResponse(null, { status: 204 });
}
