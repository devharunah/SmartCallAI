#!/usr/bin/env node
// Plays the part of the phone provider against a local SmartCallAI server, so
// the phone agent can be tested without a real number.
//
//   --provider at (default)  Africa's Talking: each caller line is turned into an
//     MP3 with OpenAI TTS, served from a tiny local HTTP server as `recordingUrl`,
//     and POSTed form-encoded like AT: call start -> one Record callback per line
//     -> final isActive=0.
//   --provider twilio        Twilio <Gather>: lines are sent as SpeechResult text
//     (Twilio does the STT), every request signed with X-Twilio-Signature, then a
//     `completed` status callback.
//
//   node scripts/voice-sim.mjs "I was charged twice this month" "yes, thanks, that's all"
//   node scripts/voice-sim.mjs --provider twilio "My card was stolen, get me a person"
//   node scripts/voice-sim.mjs "" ""                   # silence -> retry, then transfer
//   BASE=http://localhost:3100 CALLER=+254711000111 node scripts/voice-sim.mjs "..."
//
// The server must run with the same secrets: VOICE_WEBHOOK_TOKEN (AT) and
// TWILIO_AUTH_TOKEN (Twilio). dev-local.sh sets `local-dev-token` and
// `local-dev-twilio-token` unless you export your own.
import { createServer } from "node:http";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const argv = process.argv.slice(2);
const pIndex = argv.indexOf("--provider");
const provider = pIndex >= 0 ? argv.splice(pIndex, 2)[1] : "at";
const lines = argv;
if (!["at", "twilio"].includes(provider) || lines.length === 0) {
  console.error('usage: node scripts/voice-sim.mjs [--provider at|twilio] "caller line 1" ["caller line 2" ...]');
  process.exit(2);
}

function loadEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")])
  );
}
const fileEnv = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const env = (k, d) => process.env[k] || fileEnv[k] || d;

const BASE = env("BASE", "http://localhost:3100");
const CALLER = env("CALLER", "+254711000111");
const started = Date.now();

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function show(label, r) {
  console.log(`\n${label}  [HTTP ${r.status}, ${r.ms}ms]`);
  if (r.status >= 300) return console.log("  " + r.text.slice(0, 300));
  for (const m of r.text.matchAll(/<Say[^>]*>([\s\S]*?)<\/Say>/g)) console.log(`  AI  > ${decode(m[1])}`);
  const d = r.text.match(/<Dial phoneNumbers="([^"]+)"/) ?? r.text.match(/<Dial>([^<]+)<\/Dial>/);
  if (d) console.log(`  --> DIAL ${decode(d[1])}`);
  if (process.env.SHOW_XML) console.log("  xml: " + r.text);
}
async function post(url, fields, headers = {}) {
  const t = Date.now();
  const res = await fetch(url, { method: "POST", body: new URLSearchParams(fields), headers });
  return { status: res.status, text: await res.text(), ms: Date.now() - t };
}

if (provider === "at") await simulateAT();
else await simulateTwilio();

// ---- Africa's Talking --------------------------------------------------------
async function simulateAT() {
  const TOKEN = process.env.VOICE_WEBHOOK_TOKEN || "local-dev-token";
  const OPENAI_API_KEY = env("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY missing (needed to synthesize the caller's voice)");
    process.exit(2);
  }
  const sessionId = `ATVId_sim_${randomBytes(8).toString("hex")}`;

  const recordings = new Map();
  const server = createServer((req, res) => {
    const audio = recordings.get(req.url);
    if (!audio) return res.writeHead(404).end();
    res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": audio.length }).end(audio);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const recBase = `http://127.0.0.1:${server.address().port}`;

  async function synthesize(text) {
    if (!text.trim()) return Buffer.alloc(200); // "silence": too small to transcribe
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "alloy", input: text, response_format: "mp3" }),
    });
    if (!res.ok) throw new Error(`TTS failed ${res.status}: ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const atPost = (url, fields) =>
    post(url, {
      sessionId,
      direction: "Inbound",
      callerNumber: CALLER,
      destinationNumber: "+254711082000",
      callSessionState: fields.isActive === "0" ? "Completed" : "Active",
      ...fields,
    });
  const nextUrl = (xml) => {
    const m = xml.match(/<Record[^>]*callbackUrl="([^"]+)"/);
    return m ? decode(m[1]) : null;
  };

  try {
    const mainUrl = `${BASE}/api/voice/at?token=${encodeURIComponent(TOKEN)}`;
    console.log(`[at] session ${sessionId}  caller ${CALLER}  -> ${BASE}`);
    let r = await atPost(mainUrl, { isActive: "1" });
    show("CALL START", r);
    let next = r.status === 200 ? nextUrl(r.text) : null;

    for (let i = 0; i < lines.length && next; i++) {
      const path = `/rec/${i}.mp3`;
      recordings.set(path, await synthesize(lines[i]));
      console.log(`\n  YOU > ${lines[i] || "(silence)"}`);
      // AT builds callbackUrl from our XML; point it at BASE in case PUBLIC_BASE_URL is a tunnel.
      const u = new URL(next);
      r = await atPost(`${BASE}${u.pathname}${u.search}`, { isActive: "1", recordingUrl: recBase + path });
      show(`TURN ${i + 1}`, r);
      next = r.status === 200 ? nextUrl(r.text) : null;
    }
    console.log(next ? "\n(script ended while the AI was still listening; hanging up)" : "\n(AI ended or transferred the call)");

    r = await atPost(mainUrl, {
      isActive: "0",
      durationInSeconds: String(Math.round((Date.now() - started) / 1000)),
      hangupCause: "NORMAL_CLEARING",
      currencyCode: "KES",
      amount: "1.0",
    });
    console.log(`\nCALL END  [HTTP ${r.status}, ${r.ms}ms]  session=${sessionId}`);
  } finally {
    server.close();
  }
}

// ---- Twilio ------------------------------------------------------------------
async function simulateTwilio() {
  const AUTH = process.env.TWILIO_AUTH_TOKEN || "local-dev-twilio-token";
  const callSid = `CA${randomBytes(16).toString("hex")}`;
  const sign = (url, params) =>
    createHmac("sha1", AUTH)
      .update(Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url))
      .digest("base64");
  const twPost = (url, fields) => {
    const params = { CallSid: callSid, AccountSid: "ACsimulated", From: CALLER, To: "+15005550006", Direction: "inbound", ...fields };
    return post(url, params, { "X-Twilio-Signature": sign(url, params) });
  };
  const nextUrl = (xml) => {
    const m = xml.match(/<Gather[^>]*action="([^"]+)"/);
    return m ? `${BASE}${new URL(decode(m[1])).pathname}` : null;
  };

  console.log(`[twilio] call ${callSid}  from ${CALLER}  -> ${BASE}`);
  let r = await twPost(`${BASE}/api/voice/twilio`, { CallStatus: "ringing" });
  show("CALL START", r);
  let next = r.status === 200 ? nextUrl(r.text) : null;

  for (let i = 0; i < lines.length && next; i++) {
    console.log(`\n  YOU > ${lines[i] || "(silence)"}`);
    r = await twPost(next, { CallStatus: "in-progress", SpeechResult: lines[i], Confidence: lines[i] ? "0.92" : "0" });
    show(`TURN ${i + 1}`, r);
    next = r.status === 200 ? nextUrl(r.text) : null;
  }
  console.log(next ? "\n(script ended while the AI was still listening; hanging up)" : "\n(AI ended or transferred the call)");

  r = await twPost(`${BASE}/api/voice/twilio/status`, {
    CallStatus: "completed",
    CallDuration: String(Math.round((Date.now() - started) / 1000)),
  });
  console.log(`\nCALL END  [HTTP ${r.status}, ${r.ms}ms]  call=${callSid}`);
}
