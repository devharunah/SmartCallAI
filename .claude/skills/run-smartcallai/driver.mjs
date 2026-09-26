#!/usr/bin/env node
// Headless-browser driver for SmartCallAI. One-shot subcommands (no REPL —
// tmux isn't available on the Windows host this was written on).
//
//   node driver.mjs shot [route ...]        screenshot routes, e.g. / /login /admin
//   node driver.mjs call "<issue text>"     full typed-fallback call flow, screenshot per stage
//        [--mock]      intercept /api/route-call: no OpenAI call, no DB writes
//        [--mock-low]  same, but 40% confidence so the clarify stage always shows
//        [--keep-busy] don't release the assigned agent afterwards (real mode only)
//   node driver.mjs agents                  list agent availability
//   node driver.mjs release <name>          mark an agent available again
//
// Env: BASE_URL (default http://localhost:3100), SHOTS_DIR (default <os tmp>/smartcallai-shots),
//      HEADED=1 to watch the browser.
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
// VIEWPORT=390x844 for a phone-sized screenshot.
const [VW, VH] = (process.env.VIEWPORT ?? "1280x800").split("x").map(Number);
const SHOTS = process.env.SHOTS_DIR ?? join(tmpdir(), "smartcallai-shots");
const UNIT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
mkdirSync(SHOTS, { recursive: true });

const args = process.argv.slice(2);
const cmd = args.shift();
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));

async function launch() {
  // System Chrome, then Edge, then Playwright's bundled chromium (if `npx playwright-core install chromium` was run).
  for (const channel of ["chrome", "msedge", undefined]) {
    try {
      return await chromium.launch({ channel, headless: !process.env.HEADED });
    } catch (e) {
      if (channel === undefined) throw e;
    }
  }
}

let n = 0;
async function shot(page, name) {
  const file = join(SHOTS, `${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`screenshot ${file}`);
}

function watchErrors(page) {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

function envFromDotenv() {
  // Next loads .env.local over .env; dev-local.sh's override file (the env the
  // running server actually got) beats both.
  const env = {};
  for (const p of [join(UNIT, ".env"), join(UNIT, ".env.local"), join(tmpdir(), "smartcallai-dev.env")]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

// /api/route-call flips the matched agent to available=false in the live
// Supabase DB. Flip it back so repeated runs don't drain the agent pool.
async function releaseAgent(agentId) {
  // SUPABASE_URL/SERVICE_ROLE_KEY in the shell win, like they do for next dev.
  const env = { ...envFromDotenv(), ...process.env };
  const url = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return console.log("release: skipped (no SUPABASE_URL/SERVICE_ROLE_KEY)");
  try {
    const res = await fetch(`${url}/rest/v1/agents?id=eq.${agentId}`, {
      method: "PATCH",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ available: true }),
    });
    console.log(`release: agent ${agentId} -> available (${res.status}) via ${url}`);
  } catch (e) {
    console.log(`release: FAILED for agent ${agentId} via ${url}: ${e.cause?.code ?? e.message}`);
  }
}

// Git Bash (MSYS) rewrites a leading-slash arg like /admin into
// "C:/Program Files/Git/admin". Undo that, and accept bare "admin" too.
function normalizeRoute(r) {
  r = r.replace(/^[A-Za-z]:\/Program Files\/Git\/?/, "/");
  return r.startsWith("/") ? r : "/" + r;
}

async function cmdShot(routes) {
  routes = routes.map(normalizeRoute);
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const errors = watchErrors(page);
  for (const route of routes.length ? routes : ["/"]) {
    const resp = await page.goto(BASE + route, { waitUntil: "networkidle" });
    console.log(`${route} -> ${resp?.status()} ${new URL(page.url()).pathname}${new URL(page.url()).search}`);
    await shot(page, route.replace(/\W+/g, "_").replace(/^_|_$/g, "") || "home");
  }
  await browser.close();
  report(errors);
}

async function cmdCall(text) {
  if (!text) throw new Error('usage: driver.mjs call "<issue text>" [--mock] [--keep-busy]');
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const errors = watchErrors(page);

  const mock = flags.has("--mock") || flags.has("--mock-low");
  if (mock) {
    await page.route("**/api/route-call", (route) =>
      route.fulfill({
        json: {
          category: "Technical Support",
          summary: text,
          confidence: flags.has("--mock-low") ? 40 : 91, // 40 < CONFIDENCE_THRESHOLD -> clarify stage
          reason: "Mocked by driver.mjs --mock.",
          agent: { id: "mock", name: "Mock Agent", phone: "+10000000000" },
          queued: false,
          callId: "mock",
        },
      })
    );
  }
  let routed;
  page.on("response", async (r) => {
    if (r.url().endsWith("/api/route-call")) routed = await r.json().catch(() => null);
  });

  await page.goto(BASE + "/call?mode=router", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start Call" }).waitFor();
  await shot(page, "idle");

  // Headless Chrome exposes webkitSpeechRecognition, so the textarea is hidden
  // behind this link. If the browser lacks it, the textarea is already shown.
  const typeInstead = page.getByRole("button", { name: /Type instead/ });
  if (await typeInstead.isVisible()) await typeInstead.click();
  await page.getByPlaceholder("Type your issue here...").fill(text);
  await page.getByRole("button", { name: "Submit", exact: true }).click();

  // Low confidence (<threshold) lands on "clarify"; accept the guess.
  const result = page.getByText("We understood your issue");
  const clarify = page.getByText("Just to make sure we got that right");
  const error = page.locator("p.text-destructive");
  await result.or(clarify).or(error).first().waitFor({ timeout: 30_000 });
  if (await error.isVisible()) {
    await shot(page, "error");
    console.log(`ERROR stage: ${await error.innerText()}`);
    await browser.close();
    process.exit(1);
  }
  if (await clarify.isVisible()) {
    await shot(page, "clarify");
    await page.getByRole("button", { name: /Yes, that/ }).click();
    await result.waitFor();
  }
  await shot(page, "result");
  if (routed) console.log(`routed: ${JSON.stringify({ category: routed.category, confidence: routed.confidence, agent: routed.agent?.name ?? null, queued: routed.queued })}`);

  await page.getByRole("button", { name: /^(Connect to|Continue)/ }).click();
  await page.getByText(/^(Connected to|You're in the queue)/).waitFor({ timeout: 10_000 });
  await shot(page, "connected");
  await browser.close();

  if (!mock && !flags.has("--keep-busy") && routed?.agent?.id) await releaseAgent(routed.agent.id);
  report(errors);
}

function report(errors) {
  if (errors.length) console.log(`console errors (${errors.length}):\n  ` + errors.join("\n  "));
  else console.log("console errors: none");
}

async function rest(path, init = {}) {
  const env = { ...envFromDotenv(), ...process.env };
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
  });
  return res.json();
}

async function cmdAgents() {
  for (const a of await rest("agents?select=name,department,available&order=name"))
    console.log(`${a.available ? "available" : "BUSY     "}  ${a.name} (${a.department})`);
}

async function cmdRelease(name) {
  if (!name) throw new Error("usage: driver.mjs release <agent name>");
  const rows = await rest(`agents?name=eq.${encodeURIComponent(name)}`, { method: "PATCH", body: JSON.stringify({ available: true }) });
  console.log(`release: ${rows.length} agent(s) named ${name} -> available`);
}

// Voice call on /call with a fake microphone: getUserMedia is replaced by an
// AudioContext stream, and each caller line (OpenAI TTS) is played into it once
// the UI says it's listening. Deterministic, unlike Chrome's looping fake-audio flag.
async function cmdVoice(lines) {
  if (!lines.length) throw new Error('usage: driver.mjs voice "caller line" ["next line" ...]');
  const env = { ...envFromDotenv(), ...process.env };
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY needed to synthesize the caller's voice");
  const clips = [];
  for (const text of lines) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "ash", input: text, response_format: "mp3" }),
    });
    if (!res.ok) throw new Error(`TTS failed ${res.status}`);
    clips.push(Buffer.from(await res.arrayBuffer()).toString("base64"));
  }

  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      window.__fakeMic = { ctx, dest };
      return dest.stream;
    };
    window.__speak = async (b64) => {
      const { ctx, dest } = window.__fakeMic;
      await ctx.resume();
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const src = ctx.createBufferSource();
      src.buffer = await ctx.decodeAudioData(bytes.buffer);
      src.connect(dest);
      src.start();
    };
  });

  await page.goto(BASE + "/call", { waitUntil: "networkidle" });
  await shot(page, "voice-idle");
  await page.getByRole("button", { name: "Start voice call" }).click();

  const status = page.locator('[aria-live="polite"]');
  const turns = page.locator("ol li:has(p)");
  const over = /Transferred|Connecting you to|Call ended|Something went wrong/;
  for (let i = 0; i < clips.length; i++) {
    await status.filter({ hasText: /Listening|Transferred|Connecting you to|Call ended|Something went wrong/ }).waitFor({ timeout: 60_000 });
    if (over.test(await status.innerText())) break;
    const before = await turns.count();
    console.log(`  YOU > ${lines[i]}`);
    await page.evaluate((b64) => window.__speak(b64), clips[i]);
    await page.waitForFunction(
      ([sel, n]) => document.querySelectorAll(sel).length >= n + 1 && !/Thinking|Listening/.test(document.querySelector('[aria-live="polite"]').textContent),
      ["ol li:has(p)", before],
      { timeout: 60_000 }
    );
    const texts = await turns.allInnerTexts();
    for (const t of texts.slice(before)) console.log("  " + t.replace(/\s*\n+\s*/g, " | "));
    await shot(page, `voice-turn-${i + 1}`);
  }

  const endButton = page.getByRole("button", { name: /End call/ });
  if (await endButton.isVisible()) await endButton.click();
  await status.filter({ hasText: over }).waitFor({ timeout: 10_000 });
  console.log(`status: ${await status.innerText()}`);
  await shot(page, "voice-end");
  await browser.close();
  report(errors);
}

const cmds = {
  shot: () => cmdShot(positional),
  call: () => cmdCall(positional[0]),
  voice: () => cmdVoice(positional),
  agents: cmdAgents,
  release: () => cmdRelease(positional[0]),
};
if (!cmds[cmd]) {
  console.log("usage: node driver.mjs shot [route ...] | call \"<issue text>\" [--mock] [--keep-busy] | voice \"<line>\" ... | agents | release <name>");
  process.exit(2);
}
await cmds[cmd]();
