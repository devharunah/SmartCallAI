// Drives the workflow runtime with the real LLM against an in-memory menu, up
// to the confirm step (placing an order needs the database).
// Run: npx -y tsx --env-file=.env --env-file=.env.local scripts/evals/runtime-live.ts
import type { ModelMessage } from "ai";
import { runWorkflow } from "../../lib/workflow/runtime";
import { DEFAULT_WORKFLOW } from "../../lib/workflow/default";
import { detectLanguage } from "../../lib/chat/language";
import type { Conversation, Inbound } from "../../lib/chat/types";
import type { Menu, Restaurant } from "../../lib/restaurants/types";

const restaurant: Restaurant = {
  id: "r", ownerId: null, name: "Mama Rose Kitchen", slug: "mama-rose-kitchen", currency: "UGX", timezone: "Africa/Kampala",
  defaultLanguage: "lug", hours: { open: "00:00", close: "00:00" },
  delivery: { pickup: true, delivery: true, fee: 3000, areas: ["Kololo", "Ntinda", "Bukoto"] }, greeting: null, whatsappPhoneNumberId: null,
};
let n = 0;
const it = (name: string, price: number, aliases: string[], nameLg: string | null = null) => ({
  id: `item-${++n}`, categoryId: null, name, nameLg, description: null, price, available: true, imagePath: null, aliases, position: n,
});
const menu: Menu = {
  categories: [],
  items: [
    it("Classic Rolex", 5000, ["rolex", "rolexes"]),
    it("Rolex Special", 8000, ["special rolex"]),
    it("Chicken Luwombo", 25000, ["luwombo", "enkoko"], "Luwombo w'enkoko"),
    it("Beef pilau", 12000, ["pilau", "pilawo"], "Pilawo"),
    it("Fresh passion juice", 4000, ["juice", "passion"], "Omubisi gwa passion"),
    it("Soda (300ml)", 2000, ["soda", "coke", "fanta"]),
  ],
};

async function chat(script: Inbound[]) {
  let convo: Conversation = {
    id: "c", restaurantId: "r", channel: "web", customerId: "t", customerName: null, language: "lug", messages: [] as ModelMessage[],
    displayLog: [], currentNode: null, cart: { items: [] }, misses: 0, status: "active", aiPaused: false, consentShown: true,
    lastCustomerAt: null, updatedAt: "",
  };
  for (const inbound of script) {
    convo.language = detectLanguage(inbound.text) ?? convo.language;
    const started = Date.now();
    const r = await runWorkflow({ restaurant, menu, graph: DEFAULT_WORKFLOW, conversation: convo, inbound, menuImageUrls: ["/api/menu-image/demo"] });
    console.log(`\n> ${inbound.text}   [${convo.language}] ${r.trace.join(" → ")}  (${Date.now() - started}ms)`);
    for (const o of r.out) console.log("  bot:", o.type === "image" ? `[image ${o.url}]` : o.text.replace(/\n/g, "\n       "));
    convo = { ...convo, messages: [...convo.messages, { role: "user", content: inbound.text }, ...r.newMessages], currentNode: r.currentNode, cart: r.cart };
  }
  console.log("  cart:", JSON.stringify(convo.cart));
}

const scenario = process.argv[2] ?? "lug";
const scripts: Record<string, Inbound[]> = {
  lug: [
    { kind: "text", text: "Oli otya! Mpa menu" },
    { kind: "text", text: "Njagala rolex bbiri ne juice emu" },
    { kind: "text", text: "Nja kukima. Ekyo kyokka" },
  ],
  eng: [
    { kind: "text", text: "Hi, I want 2 beef pilau and a coke delivered to Ntinda near Capital Shoppers" },
    { kind: "text", text: "That's all" },
  ],
  offtopic: [{ kind: "text", text: "What's the capital of France? Also write me a poem" }],
  human: [{ kind: "text", text: "Njagala kwogera n'omuntu, order yange yali mbi" }],
};
chat(scripts[scenario]).catch((e) => {
  console.error(e);
  process.exit(1);
});
