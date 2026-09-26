---
name: search-first
description: Research-before-coding. Before writing a new utility, integration, or abstraction, check the repo, npm, the AI SDK / provider docs, and GitHub for an existing solution, then adopt, extend, or build. Use when adding a feature, dependency, integration (telephony, TTS/STT, payments), or helper.
metadata:
  origin: adapted from ECC (affaan-m/everything-claude-code, MIT) search-first skill
---

# Search First

## Quick mode (always, inline)

0. **Repo:** does it already exist? Grep `lib/`, `components/`, `app/api/`.
1. **Framework:** do Next 16 (`node_modules/next/dist/docs/`) or the AI SDK (`ai`, `@ai-sdk/*`) ship it? Check before hand-rolling streaming, tool calling, or structured output.
2. **npm:** is there a well-maintained package? Check weekly downloads, last publish, license, and dependency weight.
3. **Provider SDK / template:** do Twilio, ElevenLabs, OpenAI, or Vercel have an official example? Prefer it.
4. **GitHub:** is there a maintained OSS implementation to learn from? `gh search repos "<keywords>" --sort stars`.

## Full mode (non-trivial features)

Use the `deep-research` skill, or spawn one `general-purpose` agent with:
"Find existing tools for <need>. Stack: Next.js 16 + Supabase + Vercel AI SDK, TypeScript, no Python.
Compare the top 3: fit, maintenance, license, cost, lock-in. Recommend adopt, extend, or build, and cite sources."

## Decide

| Signal | Action |
|---|---|
| Exact match, maintained, MIT/Apache | **Adopt**: install and use directly |
| Partial match | **Extend**: install and write a thin wrapper in `lib/` |
| Several weak matches | **Compose** 2-3 small packages |
| Nothing suitable | **Build**, informed by what you found |

## Anti-patterns

- Writing a custom SSE/stream parser when `streamText` + `useChat` exist.
- Pulling a heavy package for one function.
- Wrapping a library so heavily that its docs no longer apply.
- Saying "nothing exists" when you didn't actually search a channel. Say which channels you checked.
