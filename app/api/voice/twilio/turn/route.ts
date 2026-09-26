import { toE164 } from "@/lib/voice/africastalking";
import { getSession, startSession } from "@/lib/voice/sessions";
import { handleTurn } from "@/lib/voice/turn";
import { dial, gather, hangup, publicUrl, say, twiml, verifiedParams } from "@/lib/voice/twilio";

// PUBLIC: Twilio <Gather action>. Twilio already transcribed the caller, so a
// turn is SpeechResult -> AI agent -> next <Gather> (or <Dial> / <Hangup>).
export async function POST(request: Request) {
  const params = await verifiedParams(request);
  if (!params) return new Response("Forbidden", { status: 403 });

  const callSid = params.CallSid;
  if (!callSid) return new Response("Missing CallSid", { status: 400 });

  const started = Date.now();
  const session = (await getSession(callSid)) ?? (await startSession(callSid, params.From ?? null));
  const userText = (params.SpeechResult ?? "").trim();

  const { reply, action } = await handleTurn({ session, userText, callerNumber: params.From ?? null });
  console.log(`[voice/twilio/turn] ${callSid} turn ${session.turns + 1} ${action.type} total=${Date.now() - started}ms`);

  const next = new URL("/api/voice/twilio/turn", publicUrl(request)).toString();
  switch (action.type) {
    case "retry":
    case "continue":
      return twiml(gather({ action: next, prompt: reply }));
    case "transfer":
      return action.agent ? twiml(say(reply), dial(toE164(action.agent.phone))) : twiml(say(reply), hangup());
    case "end":
      return twiml(say(reply), hangup());
  }
}
