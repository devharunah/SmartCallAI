// Item-extraction accuracy for Luganda, mixed and English order messages.
// Each sample is one message at the Take order stage; we compare the cart.
// Run: npx -y tsx --env-file=.env --env-file=.env.local scripts/evals/luganda-eval.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runWorkflow } from "../../lib/workflow/runtime";
import { DEFAULT_WORKFLOW } from "../../lib/workflow/default";
import { detectLanguage } from "../../lib/chat/language";
import { menu, newConversation, restaurant } from "./fixture";

interface Sample { lang: string; text: string; expect: Record<string, number> }
const { samples } = JSON.parse(readFileSync(join(__dirname, "luganda-samples.json"), "utf8")) as { samples: Sample[] };

async function main() {
const byLang: Record<string, { pass: number; total: number }> = {};
let pass = 0;
const delay = Number(process.env.EVAL_DELAY_MS ?? 0);
for (const s of samples) {
  if (delay) await new Promise((r) => setTimeout(r, delay));
  const conversation = { ...newConversation(), language: detectLanguage(s.text) ?? "lug" };
  const r = await runWorkflow({ restaurant, menu, graph: DEFAULT_WORKFLOW, conversation, inbound: { kind: "text", text: s.text }, menuImageUrls: [] });
  const got = Object.fromEntries(r.cart.items.map((i) => [i.name, i.qty]));
  const ok = Object.keys(s.expect).length === Object.keys(got).length && Object.entries(s.expect).every(([k, v]) => got[k] === v);
  (byLang[s.lang] ??= { pass: 0, total: 0 }).total++;
  if (ok) { byLang[s.lang].pass++; pass++; }
  const reply = r.out.map((o) => (o.type === "image" ? "[image]" : o.text)).join(" | ").replace(/\s+/g, " ").slice(0, 160);
  console.log(`${ok ? "PASS" : "FAIL"} [${s.lang}] ${s.text}\n     got ${JSON.stringify(got)}\n     reply: ${reply}`);
}
console.log(`\n${pass}/${samples.length} correct`);
for (const [lang, v] of Object.entries(byLang)) console.log(`  ${lang}: ${v.pass}/${v.total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
