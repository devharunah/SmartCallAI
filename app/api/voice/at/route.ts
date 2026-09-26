import { after } from "next/server";
import { callbackUrl, parseCallback, record, verifyToken, xmlResponse } from "@/lib/voice/africastalking";
import { GREETING } from "@/lib/voice/agent";
import { finishSession, startSession } from "@/lib/voice/sessions";

// PUBLIC: Africa's Talking voice webhook. Set this as the phone number's
// callback URL in the AT dashboard: https://<host>/api/voice/at?token=<VOICE_WEBHOOK_TOKEN>
// AT posts here when a call starts and again (isActive=0) when it ends.
export async function POST(request: Request) {
  if (!verifyToken(request)) return new Response("Forbidden", { status: 403 });

  const call = await parseCallback(request);
  if (!call) return new Response("Missing sessionId", { status: 400 });

  if (!call.isActive) {
    // Final notification: AT expects no actions, just a 200. Do the bookkeeping later.
    after(() =>
      finishSession(call.sessionId, call.durationInSeconds, "phone").catch((err) =>
        console.error("[voice/at] finishSession failed", err)
      )
    );
    return new Response(null, { status: 200 });
  }

  try {
    await startSession(call.sessionId, call.callerNumber);
  } catch (err) {
    // Still answer the caller; the turn route recreates the session if needed.
    console.error("[voice/at] startSession failed", err);
  }

  return xmlResponse(
    record({ callbackUrl: callbackUrl("/api/voice/at/turn", request), prompt: GREETING })
  );
}
