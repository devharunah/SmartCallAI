import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { transcribeAudio } from "@/lib/voice/stt";
import { speak } from "@/lib/voice/speech";
import { getSession, startSession } from "@/lib/voice/sessions";
import { handleTurn } from "@/lib/voice/turn";

// PUBLIC: in-app voice call (the /call page's "Start voice call"). Same agent as
// the phone line, no telephony provider: the browser sends one recorded clip per
// turn, we answer with the reply text and its speech.

const SESSION_ID = /^app_[0-9a-f-]{36}$/;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  if (!rateLimit(`voice-app:${clientIp(request)}`, 40, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests, try again in a few minutes" }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const sessionId = form?.get("sessionId");
  const audio = form?.get("audio");
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }
  if (!(audio instanceof Blob) || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio missing or larger than 2 MB" }, { status: 400 });
  }

  const started = Date.now();
  try {
    const session = (await getSession(sessionId)) ?? (await startSession(sessionId, null));
    if (session.status !== "active") {
      return NextResponse.json({ error: "This call has ended" }, { status: 409 });
    }

    let userText = "";
    try {
      userText = await transcribeAudio(new Uint8Array(await audio.arrayBuffer()));
    } catch (err) {
      console.error("[voice/app/turn] transcription failed", err);
    }
    const sttMs = Date.now() - started;

    const { reply, action } = await handleTurn({ session, userText, callerNumber: null });
    const speech = await speak(reply).catch((err) => {
      console.error("[voice/app/turn] speech failed", err);
      return null; // the client falls back to showing the text
    });
    console.log(`[voice/app/turn] ${sessionId} turn ${session.turns + 1} ${action.type} stt=${sttMs}ms total=${Date.now() - started}ms`);

    return NextResponse.json({
      userText,
      reply,
      action: action.type,
      agent: action.type === "transfer" ? action.agent : null,
      audio: speech,
    });
  } catch (err) {
    console.error("[voice/app/turn]", err);
    return NextResponse.json({ error: "Something went wrong on our side" }, { status: 500 });
  }
}
