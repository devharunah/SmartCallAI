---
name: run-smartcallai
description: Build, run, and drive SmartCallAI (Next.js 16 AI call-routing app). Use when asked to start the dev server, run or screenshot the customer call screen, submit a test call end to end, check the /admin or /analytics redirect, run lint/build, or confirm a change works in the real app.
---

SmartCallAI is a Next.js 16 app. Start it with `dev-local.sh`, which runs `next dev` on
**port 3100** against a **local Supabase stack**. Then drive it headlessly with
`driver.mjs`, which uses Playwright and your system Chrome/Edge and saves a screenshot at
each stage.

All paths are relative to the repo root. Verified on Windows 11 in Git Bash, with Node 22,
Podman 5 (WSL machine) and Supabase CLI 2.117.0.

## Prerequisites

- Node 22+, and Chrome or Edge installed (the driver uses `channel: "chrome"` and falls back to `msedge`).
- Podman or Docker, for local Supabase. On Windows, start Podman's VM first. It exposes the Docker API pipe, so the Supabase CLI needs no `DOCKER_HOST`:

```bash
podman machine start
```

## Setup (once)

```bash
npm install
(cd .claude/skills/run-smartcallai && npm ci)
npx -y supabase@2.117.0 start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,storage-api,postgres-meta,mailpit
```

The first `supabase start` pulls about 1 GB of images and takes several minutes. It then
applies `supabase/migrations/0001_init.sql`, which seeds 9 agents. John and Michael start
out busy (`available = false`).

## Run (agent path)

```bash
bash .claude/skills/run-smartcallai/dev-local.sh
node .claude/skills/run-smartcallai/driver.mjs shot / admin analytics login signup
node .claude/skills/run-smartcallai/driver.mjs call "My router keeps dropping the wifi connection" --mock
node .claude/skills/run-smartcallai/driver.mjs call "I was charged twice on my bill this month"
bash .claude/skills/run-smartcallai/dev-local.sh stop
```

Screenshots go to `$TEMP/smartcallai-shots/NN-<stage>.png` (on Windows,
`C:\Users\<you>\AppData\Local\Temp\smartcallai-shots\`). Override the location with
`SHOTS_DIR`. Clear the folder between runs, because the numbering restarts each run.
Dev server log: `$TEMP/smartcallai-dev.log`. Set `HEADED=1` to watch the browser.

| command | what it does |
|---|---|
| `dev-local.sh [stop]` | Starts `next dev -p $PORT` in the background, polls until it serves, and overrides the `SUPABASE_*` env with the local stack's values. `HOSTED=1` skips the override. `stop` kills the process listening on `$PORT`. |
| `driver.mjs shot [route ...]` | Loads each route, prints `route -> status finalPath`, takes a full-page screenshot, and reports console errors. |
| `driver.mjs call "<text>"` | Runs the whole typed-fallback flow: idle → "Type instead" → submit → (clarify → "Yes") → result → Connect → "Connected to X". Takes a screenshot at every stage and prints the `/api/route-call` JSON. It exits 1 if the app shows its error card. |
| `... --mock` | Stubs `/api/route-call` in the browser, so there's no OpenAI call and no DB write. Use this for pure UI changes. |
| `... --mock-low` | Same as `--mock`, but at 40% confidence, so the clarify stage always appears. |
| `... --keep-busy` | Leaves the routed agent marked busy. By default the driver sets the agent back to `available=true` through Supabase REST, so repeated runs don't use up the agent pool. |
| `driver.mjs agents` | Lists each agent's name, department, and whether it's available or BUSY. |
| `driver.mjs release <name>` | Sets that agent back to available, e.g. after a `--keep-busy` run or a failed release. |

The driver picks which Supabase to talk to in this order: shell `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, then `$TEMP/smartcallai-dev.env` (written by `dev-local.sh`, so it matches the running server), then `.env.local`, then `.env`.

Expected output of a real call:

```
routed: {"category":"Billing","confidence":95,"agent":"Grace","queued":false}
release: agent <uuid> -> available (204)
console errors: none
```

To exercise the **clarify** branch (confidence below `CONFIDENCE_THRESHOLD`), use `--mock-low`.
It forces 40% confidence and always produces `02-clarify.png`:

```bash
node .claude/skills/run-smartcallai/driver.mjs call "something is off with my account" --mock-low
```

A real vague input such as `"um hi I have a question about something"` is not reliable for
this: gpt-4o-mini scored it 50 on one run and 70 on the next, and only the first reached
clarify. To reach the
**queued** branch, occupy the last available Billing agent (Michael is seeded busy), then
submit another Billing call:

```bash
node .claude/skills/run-smartcallai/driver.mjs call "I was charged twice on my bill" --keep-busy
node .claude/skills/run-smartcallai/driver.mjs call "I was charged twice on my bill this month"
node .claude/skills/run-smartcallai/driver.mjs release Grace
```

The second call prints `"agent":null,"queued":true`.

For the API without a browser (it's public):

```bash
curl -s -X POST http://localhost:3100/api/route-call -H 'content-type: application/json' -d '{}'
```

This returns `{"error":"transcript is required"}` with status 400. `/api/agents` and
`/api/analytics` return 401 when signed out.

To inspect the local DB directly (Git Bash):

```bash
eval "$(npx -y supabase@2.117.0 status -o env 2>/dev/null | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
curl -s "$API_URL/rest/v1/calls?select=category,confidence,assigned_agent_name" -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

`/` is the marketing landing page. `/call` is the **in-app voice call** with the AI agent,
and the original speak/type-and-route flow is at `/call?mode=router` (the `call` command
goes there). For a phone-sized screenshot, set `VIEWPORT`:

```bash
SHOTS_DIR="$TEMP/smartcallai-shots/mobile" VIEWPORT=390x844 node .claude/skills/run-smartcallai/driver.mjs shot / /call
```

### In-app voice call (`/call`, no phone number)

`driver.mjs voice` replaces `getUserMedia` with an AudioContext stream. It speaks each line
(OpenAI TTS) into that stream when the UI says "Listening", then prints the transcript. It
screenshots every turn as `voice-turn-N.png`. The server side is `/api/voice/app/{greeting,turn,end}`.

```bash
node .claude/skills/run-smartcallai/driver.mjs voice "My router keeps dropping the internet every evening" "I did that and the internet light is still red, please send a technician" "No, that's all, thanks, bye"
```

The call ends by itself on the last line (status `Call ended`, server log `turn 3 end`) and
writes a `calls` row with `channel=app`. Turns take 5–11s, because OpenAI TTS adds about 2s.

### Phone agent (Africa's Talking or Twilio) without a real number

`scripts/voice-sim.mjs` plays the provider:
- **`--provider at`** (the default): speaks each line with OpenAI TTS, serves the MP3 as
  `recordingUrl`, and posts AT form callbacks to `/api/voice/at` and `/api/voice/at/turn`.
- **`--provider twilio`**: sends lines as `SpeechResult` to `/api/voice/twilio` and
  `/api/voice/twilio/turn` with a valid `X-Twilio-Signature`, then POSTs a `completed` status to
  `/api/voice/twilio/status`.

It prints what the AI says and any `DIAL`.

`dev-local.sh` exports `VOICE_WEBHOOK_TOKEN=local-dev-token` and
`TWILIO_AUTH_TOKEN=local-dev-twilio-token` unless `.env.local` sets real ones. The simulator
uses the same defaults. New migrations need `npx -y supabase@2.117.0 migration up --local`.

```bash
node scripts/voice-sim.mjs "I was charged twice on my bill this month, both have posted, please refund one" "No, that's all, thank you"
node scripts/voice-sim.mjs "My card was stolen, I need to speak to a real person right now"
node scripts/voice-sim.mjs "" "" ""
node scripts/voice-sim.mjs --provider twilio "My card got blocked after I entered the wrong PIN, I still have the card and my last purchase was at Naivas" "No that's all, bye"
curl -s -o /dev/null -w "%{http_code}
" -X POST "http://localhost:3100/api/voice/at?token=nope" -d "sessionId=x&isActive=1"
curl -s -o /dev/null -w "%{http_code}
" -X POST http://localhost:3100/api/voice/twilio -H "X-Twilio-Signature: nope" -d "CallSid=CA1"
```

These cover six cases:
1. **Refund:** resolved by the AI, which reads out an `SC-XXXXX` reference and writes a `service_requests` row.
2. **Stolen card:** `DIAL +254708234567` (Peter).
3. **Silence:** two retries, then a transfer to General Inquiry.
4. **Twilio card unblock:** resolved by the AI.
5. **Bad AT token:** `403`.
6. **Bad Twilio signature:** `403`.

Each call writes a `calls` row with `channel=phone` and `resolution`. Transfers mark the agent
busy, so free them with `driver.mjs release <name>`. The server log prints per-turn timings:
- **AT:** 3–7s. STT takes about 1–2.5s, and gpt-4o-mini with tools takes about 2–5s.
- **Twilio:** 1–4s, because Twilio transcribes the speech.

**Next 16 allows one `next dev` per project folder.** If another one is already running (for
example the user's own on :3000), `dev-local.sh` fails with "Another next dev server is already
running". Don't kill theirs. Build and serve on :3100 instead, with the same env overrides
`dev-local.sh` exports:

```bash
eval "$(npx -y supabase@2.117.0 status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SERVICE_ROLE_KEY)=')"
export SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" VOICE_WEBHOOK_TOKEN=local-dev-token TWILIO_AUTH_TOKEN=local-dev-twilio-token
npx next build && npx next start -p 3100
```

To stop everything, run the commands below. The DB is backed up to a volume, so the next
`start` is quick and keeps the rows:

```bash
bash .claude/skills/run-smartcallai/dev-local.sh stop
npx -y supabase@2.117.0 stop
```

## Run (human path)

`npm run dev` serves on :3000 using `.env.local`, which points at the hosted Supabase
project. See the gotchas below: that project no longer resolves.

## Test

The repo has no test suite. The checks are lint and build, which both passed:

```bash
npx eslint
npx next build
```

`next build` can run while `next dev` is up. Next 16 keeps dev output in `.next/dev`.

## Gotchas

- **The hosted Supabase in `.env`/`.env.local` is dead.** As of 2026-09-25, `dwbbkw….supabase.co` returns NXDOMAIN, so any `/api/route-call` fails with a 500 (`getaddrinfo ENOTFOUND`) and the UI shows "Something went wrong reaching the routing service." That's why `dev-local.sh` overrides the env with the local stack. Next gives `process.env` precedence over `.env*` files, so `.env.local` stays untouched and `OPENAI_API_KEY` is still read from it.
- **`supabase start` with an older global CLI fails:** `'config.config' has invalid keys: local_smtp`. `supabase/config.toml` was written by CLI 2.117 or later. Use `npx -y supabase@2.117.0` and don't edit the config.
- **Git Bash rewrites `/admin` to `C:/Program Files/Git/admin`** (MSYS path conversion), and Playwright then tries to navigate to `http://localhost:3100C:/Program Files/Git/`. The driver undoes this rewrite and also accepts bare `admin`. Use bare route names anyway.
- **Never run `npm install --prefix .claude/skills/run-smartcallai` from the repo root.** npm 11 adds the root package as a `"smartcallai": "file:../../.."` dependency, which creates a symlink back to the repo inside the skill's `node_modules`. Tailwind v4's source scan then panics Turbopack with `'.claude/skills/run-smartcallai/node_modules/smartcallai' is a symlink … infinite loop!`, and every page returns 500. Always `cd` into the skill directory first.
- **Port 3000 is often taken by other local Next apps**, so the skill uses 3100. `dev-local.sh stop` kills only the listener on `$PORT`, never a `pkill -f next`.
- **Headless Chrome reports `webkitSpeechRecognition` as supported**, so the text box stays hidden behind the "Speech not working? Type instead." link, and the driver clicks it. There's no microphone, so voice input can't be driven, and "Start Call" only reaches the listening stage.
- **Each real call has side effects:** it marks the agent busy and inserts a row in `calls`. The driver undoes only the busy flag. Call rows pile up, which is fine because the analytics pages read them.
- **Classification uses OpenAI when `OPENAI_API_KEY` works**, and the LLM rewrites the summary text. If the key is missing or failing, it silently falls back to keyword rules: the summary is then the raw transcript and the reason reads "Customer mentioned: …". Check which path ran from the reason text.
- **`/admin` and `/analytics` redirect to `/login?next=…` when signed out** (a 307 from `proxy.ts`). The signed-in dashboards were **not** exercised when this skill was written. The local stack has `enable_confirmations = false`, so signing up on `/signup` against it should work, but that is unverified.

## Troubleshooting

- **`page.goto: Cannot navigate to invalid URL … localhost:3100C:/Program Files/Git/`**: an MSYS path rewrite. Pass the route without the leading slash.
- **`ERROR stage: Something went wrong reaching the routing service`**: check `$TEMP/smartcallai-dev.log`. `ENOTFOUND …supabase.co` means the server is using the hosted env. Restart it with `dev-local.sh`, not `npm run dev`.
- **`FATAL: An unexpected Turbopack error` / `… node_modules/smartcallai' is a symlink … infinite loop`** (every route returns 500): this is the `--prefix` gotcha above. Run `rm .claude/skills/run-smartcallai/node_modules/smartcallai`, then restore `package.json` and `package-lock.json` in that directory from git and rerun `npm ci` there.
- **`local supabase not running`** from `dev-local.sh`: run `podman machine start`, then the `supabase start` line from Setup.
