import { timingSafeEqual } from "node:crypto";

// Africa's Talking (AT) voice transport. No AI in here: parse AT's
// form-encoded callbacks and build the Voice XML we answer with.
// Docs: https://developers.africastalking.com/docs/voice/actions/overview

export interface ATCallback {
  sessionId: string;
  isActive: boolean;
  direction: string | null;
  callerNumber: string | null;
  destinationNumber: string | null;
  recordingUrl: string | null;
  dtmfDigits: string | null;
  durationInSeconds: number | null;
  hangupCause: string | null;
  callSessionState: string | null;
}

export async function parseCallback(request: Request): Promise<ATCallback | null> {
  const form = await request.formData().catch(() => null);
  const get = (key: string) => {
    const value = form?.get(key);
    return typeof value === "string" && value !== "" && value !== "None" ? value : null;
  };

  const sessionId = get("sessionId");
  if (!sessionId) return null;

  const duration = get("durationInSeconds");
  return {
    sessionId,
    isActive: get("isActive") === "1",
    direction: get("direction"),
    callerNumber: get("callerNumber"),
    destinationNumber: get("destinationNumber"),
    recordingUrl: get("recordingUrl"),
    dtmfDigits: get("dtmfDigits"),
    durationInSeconds: duration ? Number(duration) : null,
    hangupCause: get("hangupCause"),
    callSessionState: get("callSessionState"),
  };
}

// AT does not sign callbacks, so the only proof a request came from our AT
// number is a secret token we put in the callback URLs we hand out.
export function verifyToken(request: Request): boolean {
  const expected = process.env.VOICE_WEBHOOK_TOKEN;
  if (!expected) return false;
  const given = new URL(request.url).searchParams.get("token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Absolute, token-carrying URL for AT to call back (AT needs a public URL). */
export function callbackUrl(path: string, request: Request): string {
  const base = process.env.PUBLIC_BASE_URL ?? new URL(request.url).origin;
  const url = new URL(path, base);
  url.searchParams.set("token", process.env.VOICE_WEBHOOK_TOKEN ?? "");
  return url.toString();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const VOICE = process.env.AT_VOICE ?? "en-US-Standard-C";

export function say(text: string): string {
  return `<Say voice="${escapeXml(VOICE)}">${escapeXml(text)}</Say>`;
}

/**
 * Partial record: AT plays `prompt`, records the caller until `timeout`
 * seconds of silence (or maxLength / the # key), then POSTs the recording to
 * `callbackUrl` while the call is still live and expects the next actions.
 */
export function record(opts: { callbackUrl: string; prompt?: string; maxLength?: number; timeout?: number }): string {
  const attrs = [
    `finishOnKey="#"`,
    `maxLength="${opts.maxLength ?? 30}"`,
    `timeout="${opts.timeout ?? 3}"`,
    `trimSilence="true"`,
    `playBeep="false"`,
    `callbackUrl="${escapeXml(opts.callbackUrl)}"`,
  ].join(" ");
  return `<Record ${attrs}>${opts.prompt ? say(opts.prompt) : ""}</Record>`;
}

/** AT dials E.164. Agents are stored in local format (0701…), so add the country code. */
export function toE164(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const cc = process.env.AT_COUNTRY_CODE ?? "254";
  return digits.startsWith("0") ? `+${cc}${digits.slice(1)}` : `+${digits}`;
}

export function dial(phoneNumber: string): string {
  return `<Dial phoneNumbers="${escapeXml(toE164(phoneNumber))}" record="false" sequential="true"/>`;
}

export function reject(): string {
  return "<Reject/>";
}

export function xmlResponse(...actions: string[]): Response {
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response>${actions.join("")}</Response>`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
