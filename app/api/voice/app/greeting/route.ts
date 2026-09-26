import { NextResponse } from "next/server";
import { GREETING } from "@/lib/voice/agent";
import { greetingAudio } from "@/lib/voice/speech";

// PUBLIC: the opening line of the in-app voice call, synthesized once and cached.
export async function GET() {
  try {
    return NextResponse.json({ reply: GREETING, audio: await greetingAudio() });
  } catch (err) {
    console.error("[voice/app/greeting]", err);
    return NextResponse.json({ reply: GREETING, audio: null });
  }
}
