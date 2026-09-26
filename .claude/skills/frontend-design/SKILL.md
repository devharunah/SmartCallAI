---
name: frontend-design
description: Design direction plus polish for production UI in SmartCallAI (Next.js 16, React 19, Tailwind v4, shadcn/ui). Use when building or improving pages, components, dashboards, the call screen, landing sections, or HTML reports, or when UI "looks generic", "feels off", overflows, or needs hover/focus/loading/empty states.
metadata:
  origin: adapted from ECC (affaan-m/everything-claude-code, MIT) frontend-design-direction + make-interfaces-feel-better
---

# Frontend Design

Two passes: **direction** (decide what the UI should feel like before coding)
and **polish** (the small details that make it feel finished). Then verify in the
real app with the `run-smartcallai` driver screenshots.

## This project's system (use it, don't reinvent it)

- **Tokens:** `app/globals.css`. Near-black primary `#0a0a0a`, white surfaces, `--muted #f7f7f7`, `--border #e5e5e5`, **accent `#00d4a4`** (also the focus ring), destructive `#d45656`, `--radius 0.75rem` with sm/md/lg/xl derived from it. Mintlify-inspired: quiet, high-contrast, generous whitespace.
- **Type:** Geist Sans / Geist Mono (`--font-sans`, `--font-mono`).
- **Components:** `components/ui/*` (button, card, badge, input, label, switch, table). Extend these with variants before writing new primitives.
- **Styling:** Tailwind v4 utilities referencing the tokens (`bg-muted`, `text-muted-foreground`, `ring-ring`). Never hard-code hex values in components.

## 1. Direction (before coding)

Answer these five in a sentence each:

1. **Purpose:** what job does this screen do? (The call screen gets a stressed caller to help fast. Admin lets a supervisor scan agent status.)
2. **Audience:** who repeats this, and what must they see first?
3. **Tone:** here it is usually *calm, utilitarian, trustworthy*. Expressive only on marketing surfaces.
4. **One memorable detail:** for example a live waveform, a confidence meter, or a subtle accent pulse while the AI is "thinking".
5. **Constraints:** responsive down to 360px, keyboard and screen-reader access, no new deps for decoration.

Match density to the domain. Operations screens (admin, analytics) are dense and
scannable. Caller-facing screens get one primary action at a time.

## 2. Implementation guidance

- The first viewport shows the actual product/workflow, not a marketing hero.
- One primary action per state. Secondary actions use `variant="outline"`/`ghost`.
- Multi-button rows must **wrap or stack**: `flex flex-col sm:flex-row sm:flex-wrap`, and give long labels `whitespace-normal text-left` or a shorter label. (The clarify stage's third button overflows its card at 1280px. Don't repeat that.)
- Every async surface needs **idle / loading / success / empty / error** states. Loading shows skeletons or an inline spinner in the triggering button. Errors say what happened and what to do next.
- Real-time/voice UI: show connection state (connecting → live → ended), who's speaking, and a visible way to end or mute. Never leave the user guessing whether the mic is on.
- Palettes stay neutral plus one accent. Use the accent for focus, the live state, and the primary highlight. Don't flood surfaces with it.
- Responsive: explicit grids, min/max widths, stable toolbars. Tables scroll inside `overflow-x-auto`, never the page.

## 3. Polish (the details that compound)

- **Concentric radius:** outer radius = inner radius + padding for nested rounded surfaces.
- **Optical alignment:** nudge play/arrow icons a pixel or so. Geometric center ≠ visual center.
- **Borders vs shadows:** borders separate; soft layered shadows only for things that float (popovers, dialogs).
- **Text wrap:** `text-balance` on headings, `text-pretty` on short body text. **`tabular-nums`** on timers, counters, prices, and percentages (call duration, confidence %).
- **Motion:** CSS transitions for state changes. Enter = opacity + small translateY (~200ms), exit is shorter (~150ms). Press = `active:scale-[0.97]`. **Never `transition: all`**; list the properties. Respect `prefers-reduced-motion`.
- **Hit areas:** ≥40×40px (44 ideal) for every control, especially mic/end-call buttons.
- **Focus:** a visible `focus-visible:ring-2 ring-ring ring-offset-2` on everything interactive.
- **Images:** a neutral 1px inset outline (`outline outline-1 -outline-offset-1 outline-black/10`, `dark:outline-white/10`).

## Anti-patterns

- Purple gradients, decorative blobs, stock "AI" imagery, vague hero copy.
- Cards inside cards. Oversized cards with one line of text.
- Describing features in the UI when the controls speak for themselves.
- New dependencies for flourishes (a whole animation lib for one fade).
- Hiding the primary workflow behind marketing sections.

## Verify (required)

```bash
bash .claude/skills/run-smartcallai/dev-local.sh
node .claude/skills/run-smartcallai/driver.mjs shot / admin
node .claude/skills/run-smartcallai/driver.mjs call "My router keeps dropping" --mock-low
```

Look at the screenshots in `$TEMP/smartcallai-shots/`. Check text fit, overflow,
and states. For mobile, set the viewport in the driver or use the browser pane's
`resize_window` preset `mobile`.

## Review output format

| Principle | Before | After | File |
|---|---|---|---|
| Button row wrap | 3 buttons overflow card at 1280px | `sm:flex-wrap` + shorter label | components/call-session.tsx |

List only the principles you changed.
