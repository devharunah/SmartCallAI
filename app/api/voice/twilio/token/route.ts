import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// PUBLIC: short-lived Twilio Access Token so a browser can place a call with
// @twilio/voice-sdk to our TwiML App (no phone number needed; Twilio then hits
// /api/voice/twilio like any call). Built by hand to avoid the 10 MB `twilio`
// package: an HS256 JWT signed with an API Key secret, format per
// https://www.twilio.com/docs/iam/access-tokens
const TTL_SECONDS = 600;

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

export async function GET(request: Request) {
  const { TWILIO_ACCOUNT_SID: account, TWILIO_API_KEY_SID: keySid, TWILIO_API_KEY_SECRET: keySecret, TWILIO_TWIML_APP_SID: appSid } =
    process.env;
  if (!account || !keySid || !keySecret || !appSid) {
    return NextResponse.json({ error: "Twilio browser calling is not configured" }, { status: 503 });
  }
  if (!rateLimit(`twilio-token:${clientIp(request)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const now = Math.floor(Date.now() / 1000);
  const identity = `web-${randomUUID()}`;
  const header = { typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" };
  const payload = {
    jti: `${keySid}-${now}`,
    iss: keySid,
    sub: account,
    iat: now,
    exp: now + TTL_SECONDS,
    // Same shape the official twilio AccessToken + VoiceGrant produces (outgoing only).
    grants: { identity, voice: { outgoing: { application_sid: appSid } } },
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const token = `${unsigned}.${b64url(createHmac("sha256", keySecret).update(unsigned).digest())}`;

  return NextResponse.json({ token, identity, expiresIn: TTL_SECONDS });
}
