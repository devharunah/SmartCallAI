import { createHmac, timingSafeEqual } from "node:crypto";

// Twilio Programmable Voice transport. No AI in here: verify Twilio's signed
// webhooks and build TwiML. Uses <Gather input="speech"> so Twilio does the
// speech-to-text and each turn is a plain webhook — this also works on a free
// trial account, where <Record>, <Stream> and <ConversationRelay> are blocked.
// Docs: https://www.twilio.com/docs/usage/webhooks/webhooks-security

/** The URL Twilio signed: the public one (tunnel/deployment), not localhost. */
export function publicUrl(request: Request): string {
  const url = new URL(request.url);
  const base = process.env.PUBLIC_BASE_URL;
  return base ? new URL(url.pathname + url.search, base).toString() : url.toString();
}

export function signTwilio(url: string, params: Record<string, string>, authToken: string): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

/** Parse the form body and check X-Twilio-Signature. Returns null if invalid. */
export async function verifiedParams(request: Request): Promise<Record<string, string> | null> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get("x-twilio-signature");
  if (!authToken || !signature) return null;

  const form = await request.formData().catch(() => null);
  if (!form) return null;
  const params: Record<string, string> = {};
  for (const [key, value] of form) if (typeof value === "string") params[key] = value;

  const expected = Buffer.from(signTwilio(publicUrl(request), params, authToken));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? params : null;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const VOICE = process.env.TWILIO_VOICE ?? "Polly.Joanna-Neural";

export function say(text: string): string {
  return `<Say voice="${escapeXml(VOICE)}">${escapeXml(text)}</Say>`;
}

/**
 * Speak `prompt`, then listen. Twilio transcribes and POSTs `SpeechResult` to
 * `action`; actionOnEmptyResult makes silence reach us too (our retry logic).
 */
export function gather(opts: { action: string; prompt: string }): string {
  return (
    `<Gather input="speech" speechTimeout="auto" language="en-US" actionOnEmptyResult="true" method="POST" action="${escapeXml(opts.action)}">` +
    `${say(opts.prompt)}</Gather>`
  );
}

/** Note: <Dial><Number> is stripped on trial accounts; it works once upgraded. */
export function dial(phoneE164: string): string {
  return `<Dial>${escapeXml(phoneE164)}</Dial>`;
}

export function hangup(): string {
  return "<Hangup/>";
}

export function twiml(...verbs: string[]): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${verbs.join("")}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}
