#!/usr/bin/env node
// Sends signed, WhatsApp-shaped webhook payloads to the local app, so the
// webhook can be tested without Meta. Replies go to the real Graph API only if
// WHATSAPP_TOKEN is set; otherwise sending fails after the engine runs (check
// the dev server log and the dashboard inbox).
//
//   node scripts/wa-sim.mjs text "Oli otya! Mpa menu"
//   node scripts/wa-sim.mjs button confirm_yes "Yee, kakasa"
//   node scripts/wa-sim.mjs duplicate "hello"     # same wamid twice: second is ignored
//   node scripts/wa-sim.mjs badsig "hello"        # expect 401
//   node scripts/wa-sim.mjs verify                # GET subscription handshake
//
// Env: BASE (default http://localhost:3000), WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN,
//      WHATSAPP_PHONE_NUMBER_ID, FROM (default 256700000001)

import { createHmac, randomUUID } from "node:crypto";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SECRET = process.env.WHATSAPP_APP_SECRET ?? "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "000000000000000";
const FROM = process.env.FROM ?? "256700000001";
const [mode = "text", ...args] = process.argv.slice(2);

function payload(message) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "256700000000", phone_number_id: PHONE_NUMBER_ID },
              contacts: [{ profile: { name: "Test Customer" }, wa_id: FROM }],
              messages: [{ from: FROM, id: `wamid.SIM${randomUUID().replace(/-/g, "")}`, timestamp: String(Math.floor(Date.now() / 1000)), ...message }],
            },
          },
        ],
      },
    ],
  };
}

async function post(body, { badSignature = false } = {}) {
  const raw = JSON.stringify(body);
  const signature = "sha256=" + createHmac("sha256", badSignature ? "wrong-secret" : SECRET).update(raw).digest("hex");
  const res = await fetch(`${BASE}/api/whatsapp/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": signature },
    body: raw,
  });
  console.log(res.status, await res.text());
  return res.status;
}

if (!SECRET && mode !== "verify") {
  console.error("Set WHATSAPP_APP_SECRET (same value as the dev server) to sign payloads.");
  process.exit(1);
}

if (mode === "verify") {
  const token = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  const res = await fetch(`${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=12345`);
  console.log(res.status, await res.text(), "(expect 200 12345)");
} else if (mode === "text") {
  await post(payload({ type: "text", text: { body: args.join(" ") || "Oli otya! Mpa menu" } }));
} else if (mode === "button") {
  const [id = "confirm_yes", ...title] = args;
  await post(payload({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: title.join(" ") || "Yes" } } }));
} else if (mode === "audio") {
  // The media id won't exist on Meta, so this exercises the "couldn't transcribe" path.
  await post(payload({ type: "audio", audio: { id: "1234567890", mime_type: "audio/ogg; codecs=opus", voice: true } }));
} else if (mode === "duplicate") {
  const body = payload({ type: "text", text: { body: args.join(" ") || "hello" } });
  await post(body);
  await post(body);
  console.log("Second post should be acknowledged but not processed (check the server log).");
} else if (mode === "badsig") {
  const status = await post(payload({ type: "text", text: { body: args.join(" ") || "hello" } }), { badSignature: true });
  console.log(status === 401 ? "OK: rejected" : "FAIL: expected 401");
} else {
  console.error(`Unknown mode "${mode}"`);
  process.exit(1);
}
