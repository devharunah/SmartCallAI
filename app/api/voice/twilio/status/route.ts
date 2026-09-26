import { after } from "next/server";
import { finishSession } from "@/lib/voice/sessions";
import { verifiedParams } from "@/lib/voice/twilio";

// PUBLIC: Twilio call status callback (set "Call status changes" on the number,
// or Status Callback URL on the TwiML App). On `completed`, write the calls row.
export async function POST(request: Request) {
  const params = await verifiedParams(request);
  if (!params) return new Response("Forbidden", { status: 403 });

  if (params.CallSid && ["completed", "busy", "no-answer", "failed", "canceled"].includes(params.CallStatus ?? "")) {
    const duration = params.CallDuration ? Number(params.CallDuration) : null;
    // Browser (Client) calls have no phone number on the caller side.
    const channel = params.From?.startsWith("client:") ? "app" : "phone";
    after(() => finishSession(params.CallSid, duration, channel).catch((err) => console.error("[voice/twilio/status]", err)));
  }
  return new Response(null, { status: 204 });
}
