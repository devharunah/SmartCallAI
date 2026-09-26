import { GREETING } from "@/lib/voice/agent";
import { startSession } from "@/lib/voice/sessions";
import { gather, publicUrl, twiml, verifiedParams } from "@/lib/voice/twilio";

// PUBLIC: Twilio voice webhook ("A call comes in" on the number, or the Voice URL
// of a TwiML App for browser calls). Signed by Twilio; see lib/voice/twilio.ts.
export async function POST(request: Request) {
  const params = await verifiedParams(request);
  if (!params) return new Response("Forbidden", { status: 403 });

  const callSid = params.CallSid;
  if (!callSid) return new Response("Missing CallSid", { status: 400 });

  try {
    await startSession(callSid, params.From ?? null);
  } catch (err) {
    console.error("[voice/twilio] startSession failed", err);
  }

  return twiml(gather({ action: new URL("/api/voice/twilio/turn", publicUrl(request)).toString(), prompt: GREETING }));
}
