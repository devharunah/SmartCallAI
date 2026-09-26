---
name: backend-patterns
description: Server-side patterns for SmartCallAI with Next.js 16 route handlers, Supabase (service-role + @supabase/ssr auth), and the Vercel AI SDK. Use when adding or changing API routes, auth checks, DB queries or migrations, LLM/tool calls, streaming, webhooks (Twilio/telephony), validation, error handling, or rate limiting.
metadata:
  origin: adapted from ECC (affaan-m/everything-claude-code, MIT) backend-patterns + api-design
---

# Backend Patterns

TypeScript only. There is **no separate Python backend**: route handlers in `app/api/**/route.ts`
plus modules in `lib/` are the backend. Read `node_modules/next/dist/docs/` for
Next 16 specifics before using an unfamiliar API (see AGENTS.md).

## Layout (follow it)

| Layer | Where | Rule |
|---|---|---|
| HTTP | `app/api/<resource>/route.ts` | Parse → validate → call lib → shape response. No SQL here. |
| Domain / data | `lib/<domain>.ts` (`agents.ts`, `calls.ts`, `classify.ts`) | One module per domain. Returns typed objects from `lib/types.ts`. |
| DB client | `lib/supabase.ts` (service role, server only) · `lib/supabase/server.ts` (user session) · `lib/supabase/client.ts` (browser) | Never import the service-role client from a client component. |
| Auth gate | `proxy.ts` → `lib/supabase/proxy.ts` (pages), `requireApiUser()` in `lib/auth.ts` (APIs) | Public endpoints say so in a comment (see `route-call`). |
| Schema | `supabase/migrations/NNNN_*.sql` | New migration per change. Never edit an applied one. |

## Route handler template

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";

const Body = z.object({ name: z.string().min(1).max(100), department: z.enum(CATEGORIES) });

export async function POST(request: Request) {
  const { unauthorized } = await requireApiUser();   // omit ONLY for deliberately public routes
  if (unauthorized) return unauthorized;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });

  try {
    const agent = await createAgent(parsed.data);      // lib/agents.ts
    return NextResponse.json(agent, { status: 201 });
  } catch (err) {
    console.error("[POST /api/agents]", err);
    return NextResponse.json({ error: "Could not create agent" }, { status: 500 });
  }
}
```

- **Errors:** always `{ error: string }` JSON with the right status (400 validation, 401/403 auth, 404, 409 conflict, 429, 500). Never leak stack traces or Supabase error text to public routes.
- **Validation:** zod at the boundary (add it with `npm i zod`; the AI SDK uses it for tool schemas anyway). Existing handlers validate by hand. Match the file you're in, and prefer zod for new ones.
- **REST shape:** plural nouns (`/api/agents`, `/api/agents/[id]`), `GET` list/read, `POST` create, `PATCH` partial update, `DELETE`. Filters in the query string.

## Supabase

- Check `error` on every call: `const { data, error } = await supabase.from(...); if (error) throw error;`
- Select only the needed columns. Add an index in a migration for any new filter column.
- **Race conditions:** "find available agent, then mark busy" is two round-trips, so two callers can grab the same agent. For anything contended, use one atomic statement (a Postgres function called with `.rpc()` that runs `UPDATE … WHERE available LIMIT 1 RETURNING *` with `FOR UPDATE SKIP LOCKED`).
- Service role bypasses RLS. Keep it server-only and keep RLS policies on for anything the browser client touches.

## AI / LLM calls (Vercel AI SDK)

- Server-side only. Keys come from `process.env` and never reach the client.
- Use `generateObject`/`generateText` with a zod schema for structured output (classification, extraction) instead of hand-parsing JSON.
- Use `streamText(...).toUIMessageStreamResponse()` for chat/voice-turn streaming to `useChat`.
- **Tools:** define with `tool({ description, inputSchema: z.object(...), execute })`. Execute functions are backend code: validate, authorize, keep them idempotent, and return small JSON.
- Bound agent loops with `stopWhen: stepCountIs(n)`. Set `maxOutputTokens` and `abortSignal`, and time out upstream calls.
- **Always have a fallback path** (like `classify.ts`'s keyword fallback) and log which path ran.
- Record cost/latency per call (`usage` from the result) into the `calls` table if analytics needs it.

## Webhooks (telephony, e.g. Twilio)

- Verify the provider signature before doing anything, and reject with 403 on mismatch.
- Respond fast (<2s for voice). Push slow work to `after()` from `next/server` or a queue.
- Make handlers **idempotent** on the provider's event/call SID. Retries will happen.
- WebSocket media streams need a long-lived server. Vercel Functions don't hold raw WebSockets, so plan a small Node WS service or use a provider SDK that bridges it (see the research doc).

## Security checklist (every new endpoint)

- [ ] Auth decided explicitly (`requireApiUser()` or a "PUBLIC:" comment explaining why).
- [ ] Input validated and bounded (string lengths, enums).
- [ ] No secrets in responses or logs. No `NEXT_PUBLIC_` on server secrets.
- [ ] Rate limit public/LLM routes (per IP or per session) so one caller can't burn the OpenAI budget.
- [ ] Redirect targets pass `safeNextPath()`.

## Verify

```bash
npx eslint
npx next build
curl -s -X POST http://localhost:3100/api/route-call -H 'content-type: application/json' -d '{}'
```

Then drive the real flow with `run-smartcallai` (`driver.mjs call "..."`).
