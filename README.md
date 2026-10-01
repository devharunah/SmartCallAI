# Order AI

**Your restaurant on WhatsApp, taking orders in Luganda and English.**

Order AI is an AI assistant for restaurants in Uganda. Customers message the restaurant's WhatsApp by text or voice note. The assistant sends the menu as a picture, takes the order, shows the customer the total to confirm, and puts the order on the restaurant's live board. Owners see and edit how the assistant behaves as a workflow diagram.

> The name is a placeholder that lives in `lib/brand.ts`. Change it there to rename the product.

The research behind the product is in [`docs/research/whatsapp-restaurant-uganda.html`](docs/research/whatsapp-restaurant-uganda.html). It covers WhatsApp pricing, Luganda language support, the Kampala market, payments and data protection.

---

## What's in the app

| Route | Who | What it does |
| --- | --- | --- |
| `/` | everyone | Landing page |
| `/try` | everyone | WhatsApp-style demo chat with the "Mama Rose Kitchen" demo restaurant. Supports text, voice notes, and Luganda or English |
| `/onboarding` | signed in | Create your restaurant, optionally with a sample Kampala menu |
| `/dashboard` | owner | Live orders board with a chime, browser notifications and status updates sent to the customer |
| `/dashboard/inbox` | owner | Every chat, live. Take over from the AI and reply yourself |
| `/dashboard/menu` | owner | Items, prices (UGX), Luganda names, alternative names, sold-out switch and menu photos |
| `/dashboard/workflow` | owner | The bot as an editable diagram, with a test chat beside it |
| `/dashboard/insights` | owner | Orders, revenue, top items, AI-handled share, voice-note share, and WhatsApp free-reply usage |
| `/dashboard/settings` | owner | Hours, delivery areas and fee, default language, WhatsApp number |
| `/api/whatsapp/webhook` | Meta | WhatsApp Cloud API webhook (signed) |

The earlier voice agent (`/call`, `/api/voice/*`, `/admin` and `/analytics`) still works but is no longer linked from the app.

## How it works

```
WhatsApp ──webhook──▶ /api/whatsapp/webhook ─┐
                                              ├─▶ lib/chat/engine.ts ─▶ lib/workflow/runtime.ts ─▶ Supabase
Browser demo ──────▶ /api/chat/web ──────────┘         (one engine, any channel)        │ Realtime
                                                                                         ▼
                                                                                  /dashboard
```

- **The workflow** (`lib/workflow/`) is a graph of steps, modelled on ElevenLabs Agents.
  - **AI stages** call the LLM with their own instructions and tools. A generated `goto` tool lets the model choose a plain-language exit.
  - **Fixed steps** run in code: send menu, confirm order, place order, and hand off to a person. Prices and totals therefore always come from the database, never from the model.
- **Language:**
  - Replies follow the customer's language.
  - Fixed messages such as order summaries and status updates have templates in both languages (`lib/chat/language.ts`).
  - **The Luganda templates need a native speaker's review before launch.**
- **Models:**
  - Gemini 2.5 Flash writes Luganda best, so it's the default. It's reached with `GOOGLE_GENERATIVE_AI_API_KEY`, or through the Vercel AI Gateway with `AI_GATEWAY_API_KEY`.
  - GPT-4o-mini is the fallback. It understands Luganda orders but writes clumsy Luganda.
- **Voice notes:**
  - Transcribed with **Sunbird AI**, a Ugandan service that handles Luganda and English.
  - ElevenLabs Scribe is the fallback.
  - Whisper and OpenAI's transcription don't support Luganda.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment file and fill it in:

   ```bash
   cp .env.local.example .env.local
   ```

   The minimum is the Supabase keys, `OPENAI_API_KEY`, and a Gemini key. Add `SUNBIRD_API_KEY` for Luganda voice notes.

3. Apply the database migrations. `0003_restaurants.sql` creates the restaurant tables, RLS, Realtime, the `menus` storage bucket and the demo restaurant.

   ```bash
   npx supabase@latest link --project-ref <ref>
   npx supabase@latest db push
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

   Open `/try` for the demo, or sign up and go to `/dashboard`.

### Connect WhatsApp

1. In a Meta developer app, add the WhatsApp product. Copy the temporary access token and the phone number ID into `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. Copy the app secret into `WHATSAPP_APP_SECRET`.
2. Set `PUBLIC_BASE_URL` to a public URL, such as your deployment or a tunnel like `cloudflared tunnel --url http://localhost:3000`. WhatsApp fetches menu images from this URL.
3. Set the webhook callback to `https://<PUBLIC_BASE_URL>/api/whatsapp/webhook`. Use your `WHATSAPP_VERIFY_TOKEN` as the verify token, and subscribe to `messages`.
4. The test number answers for the demo restaurant. To route it to your own restaurant instead, enter the phone number ID in **Dashboard → Settings**.

Meta's free test number can only message about 5 verified phones, which is why `/try` exists. Each restaurant connecting its own number needs Meta Tech Provider status and Embedded Signup, which is planned for later.

## Checks

```bash
npm run lint
npx next build
npx -y tsx scripts/check-logic.ts        # offline: workflow validation, conditions, language detection, menu search, totals
npx -y tsx --env-file=.env --env-file=.env.local scripts/evals/runtime-live.ts lug    # live LLM: lug | eng | offtopic | human
npx -y tsx --env-file=.env --env-file=.env.local scripts/evals/luganda-eval.ts        # item-extraction accuracy on scripts/evals/luganda-samples.json
node scripts/wa-sim.mjs text "Oli otya! Mpa menu"                                     # signed fake WhatsApp webhook (needs WHATSAPP_APP_SECRET)
```

## Stack

Next.js 16 (App Router), React 19, Tailwind v4 and shadcn/ui, Supabase (Postgres, Auth, Realtime and Storage), Vercel AI SDK 7, `@xyflow/react`, WhatsApp Cloud API, Sunbird AI.
