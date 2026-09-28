// Offline checks for the chat engine's pure logic (no DB, no LLM).
// Run: npx -y tsx scripts/check-logic.ts
import assert from "node:assert/strict";
import { DEFAULT_WORKFLOW } from "../lib/workflow/default";
import { validateGraph, WorkflowGraph } from "../lib/workflow/schema";
import { evalExpr } from "../lib/workflow/expr";
import { detectLanguage } from "../lib/chat/language";
import { searchMenu } from "../lib/chat/tools";
import { cartSummary } from "../lib/chat/cart";
import { isOpenNow } from "../lib/restaurants/data";
import type { MenuItem, Restaurant } from "../lib/restaurants/types";

assert.deepEqual(validateGraph(DEFAULT_WORKFLOW), [], "default workflow is valid");
assert.ok(WorkflowGraph.safeParse(DEFAULT_WORKFLOW).success);
const broken = { ...DEFAULT_WORKFLOW, edges: [...DEFAULT_WORKFLOW.edges, { id: "x", source: "take_order", target: "place_order", kind: "llm" as const, condition: "skip" }] };
assert.ok(validateGraph(broken).some((p) => p.includes("Confirm")), "place_order only via confirm");

const ctx = { "cart.count": 2, "cart.total": 12000, isOpen: true, fulfillment: "delivery", hasAddress: true, language: "lug" };
assert.equal(evalExpr("cart.count > 0 && isOpen == true", ctx), true);
assert.equal(evalExpr("isOpen == false", ctx), false);
assert.equal(evalExpr("fulfillment == delivery", ctx), true);
assert.throws(() => evalExpr("process.exit()", ctx));

assert.equal(detectLanguage("Oli otya! Mpa menu"), "lug");
assert.equal(detectLanguage("Njagala rolex bbiri ne juice"), "lug");
assert.equal(detectLanguage("Hi, can I see the menu please?"), "eng");
assert.equal(detectLanguage("Two rolexes and a passion juice please"), "eng");
assert.equal(detectLanguage("ok"), null);

const item = (id: string, name: string, aliases: string[], nameLg: string | null = null): MenuItem => ({
  id, categoryId: null, name, nameLg, description: null, price: 5000, available: true, imagePath: null, aliases, position: 0,
});
const items = [
  item("1", "Classic Rolex", ["rolex", "rolexes"]),
  item("2", "Rolex Special", ["special rolex"]),
  item("3", "Chicken Luwombo", ["luwombo", "enkoko"], "Luwombo w'enkoko"),
  item("4", "Fresh passion juice", ["juice", "passion"], "Omubisi gwa passion"),
  item("5", "Matooke & groundnut sauce", ["matooke", "binyebwa"], "Matooke n'ebinyeebwa"),
];
assert.equal(searchMenu(items, "rolex")[0].id, "1");
assert.equal(searchMenu(items, "luwombo")[0].id, "3");
assert.equal(searchMenu(items, "omubisi")[0].id, "4");
assert.equal(searchMenu(items, "pizza").length, 0);

const restaurant: Restaurant = {
  id: "r", ownerId: null, name: "Mama Rose Kitchen", slug: "m", currency: "UGX", timezone: "Africa/Kampala",
  defaultLanguage: "lug", hours: { open: "07:00", close: "22:30" },
  delivery: { pickup: true, delivery: true, fee: 3000, areas: ["Ntinda"] }, greeting: null, whatsappPhoneNumberId: null,
};
const summary = cartSummary({ items: [{ menuItemId: "1", name: "Classic Rolex", unitPrice: 5000, qty: 2 }], fulfillment: "delivery", address: "Ntinda" }, restaurant, "eng");
assert.match(summary, /2 × Classic Rolex: UGX 10,000/);
assert.match(summary, /Total: UGX 13,000/);
console.log(summary);

// 20:00 UTC = 23:00 Kampala (closed); 06:00 UTC = 09:00 (open)
assert.equal(isOpenNow(restaurant, new Date("2026-09-29T20:00:00Z")), false);
assert.equal(isOpenNow(restaurant, new Date("2026-09-29T06:00:00Z")), true);
assert.equal(isOpenNow({ ...restaurant, hours: { open: "18:00", close: "02:00" } }, new Date("2026-09-29T21:30:00Z")), true);
console.log("all logic checks passed");
