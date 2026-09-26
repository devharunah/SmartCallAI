import { after } from "next/server";
import { callbackUrl, dial, parseCallback, record, say, verifyToken, xmlResponse } from "@/lib/voice/africastalking";
import { transcribeRecording } from "@/lib/voice/stt";
import { finishSession, getSession, startSession } from "@/lib/voice/sessions";
import { handleTurn } from "@/lib/voice/turn";

// PUBLIC: Africa's Talking <Record callbackUrl>. AT posts the caller's recording
// here mid-call and plays whatever XML we answer with. One request = one turn:
// recording -> text -> AI agent -> spoken reply + record again.
export async function POST(request: Request) {
  if (!verifyToken(request)) return new Response("Forbidden", { status: 403 });

  const call = await parseCallback(request);
  if (!call) return new Response("Missing sessionId", { status: 400 });

  if (!call.isActive) {
    after(() => finishSession(call.sessionId, call.durationInSeconds, "phone").catch((err) => console.error("[voice/at/turn] finish", err)));
    return new Response(null, { status: 200 });
  }

  const started = Date.now();
  const next = callbackUrl("/api/voice/at/turn", request);
  const session = (await getSession(call.sessionId)) ?? (await startSession(call.sessionId, call.callerNumber));

  let userText = "";
  if (call.recordingUrl) {
    try {
      userText = await transcribeRecording(call.recordingUrl);
    } catch (err) {
      console.error("[voice/at/turn] transcription failed", err);
    }
  }
  const sttMs = Date.now() - started;

  const { reply, action } = await handleTurn({ session, userText, callerNumber: call.callerNumber });
  console.log(`[voice/at/turn] ${call.sessionId} turn ${session.turns + 1} ${action.type} stt=${sttMs}ms total=${Date.now() - started}ms`);

  switch (action.type) {
    case "retry":
    case "continue":
      return xmlResponse(record({ callbackUrl: next, prompt: reply }));
    case "transfer":
      return action.agent ? xmlResponse(say(reply), dial(action.agent.phone)) : xmlResponse(say(reply));
    case "end":
      return xmlResponse(say(reply)); // no further actions: AT hangs up
  }
}
