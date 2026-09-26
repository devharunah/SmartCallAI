---
name: verification-loop
description: Pre-PR verification for SmartCallAI covering lint, type-check/build, secret scan, a real-app smoke run via the run-smartcallai driver, and a diff review, with a pass/fail report. Use before committing, opening a PR, or saying "done", or when asked to "verify", "check everything", or "make sure it works".
metadata:
  origin: adapted from ECC (affaan-m/everything-claude-code, MIT) verification-loop skill
---

# Verification Loop

Run the phases in order. Stop at the first FAIL, fix it, and rerun from that phase.

1. **Lint:** `npx eslint`
2. **Types + build:** `npx next build` (runs `tsc`; safe while `next dev` is up)
3. **Secrets / debug leftovers** in the diff:
   ```bash
   git diff --cached -U0 | grep -nE '(sk-[A-Za-z0-9]{20,}|SUPABASE_SERVICE_ROLE_KEY=|eyJhbGciOi)' || echo "no secrets"
   git diff -U0 -- '*.ts' '*.tsx' | grep -n '^+.*console\.log' || echo "no console.log"
   ```
4. **Real app smoke** (the repo has no test suite, so this is the test). Follow `run-smartcallai`:
   ```bash
   bash .claude/skills/run-smartcallai/dev-local.sh
   node .claude/skills/run-smartcallai/driver.mjs shot / admin login
   node .claude/skills/run-smartcallai/driver.mjs call "I was charged twice on my bill this month"
   ```
   Open the screenshots and check them. A 200 response alone is not a pass.
5. **Diff review:** `git diff --stat` and then read every hunk for leftover TODOs, unintended files, or public routes missing auth (see `backend-patterns` checklist).

## Report

```
VERIFICATION: PASS | FAIL
lint      ✓/✗
build     ✓/✗
secrets   ✓/✗
smoke     ✓/✗  (routes shot, call result, console errors)
diff      ✓/✗  (N files, notes)
```

Report failures verbatim with the command output. Never claim a phase passed if it was skipped. Say "skipped" and why.
