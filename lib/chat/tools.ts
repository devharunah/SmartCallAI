import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { formatUgx, isOpenNow } from "../restaurants/data";
import type { Menu, MenuItem, Restaurant } from "../restaurants/types";
import type { AgentToolName } from "../workflow/schema";
import { cartForModel } from "./cart";
import type { Cart } from "./types";

// The actions an agent stage can take. Tools only change the cart or queue
// side effects; the runtime decides what to send and where to go next.

export interface ToolEffects {
  sendMenu: boolean;
  handoff: string | null;
}

export interface ToolContext {
  restaurant: Restaurant;
  menu: Menu;
  cart: Cart; // mutated in place
  effects: ToolEffects;
}

export function buildTools(names: readonly AgentToolName[], ctx: ToolContext): ToolSet {
  const all = {
    searchMenu: tool({
      description:
        "Find menu items by name, Luganda name or local name (e.g. rolex, katogo, luwombo, chapo). Returns item ids for addToCart.",
      inputSchema: z.object({ query: z.string().min(1).max(100) }),
      execute: async ({ query }) => {
        const hits = searchMenu(ctx.menu.items, query);
        return hits.length
          ? hits.map(itemForModel)
          : { result: "No matching item. Say it isn't on the menu and suggest something similar from the menu list." };
      },
    }),
    addToCart: tool({
      description: "Add a menu item to the customer's order. Use the exact itemId from the menu or searchMenu.",
      inputSchema: z.object({
        itemId: z.string(),
        qty: z.number().int().min(1).max(50).default(1),
        notes: z.string().max(120).optional().describe("Customer's request for this item, e.g. 'no onions'"),
      }),
      execute: async ({ itemId, qty, notes }) => {
        const item = ctx.menu.items.find((i) => i.id === itemId);
        if (!item) return { ok: false, result: "Unknown itemId. Use searchMenu to find the right item first." };
        if (!item.available) return { ok: false, result: `${item.name} is sold out today. Suggest something else.` };
        const line = ctx.cart.items.find((l) => l.menuItemId === itemId && (l.notes ?? "") === (notes ?? ""));
        if (line) line.qty += qty;
        else ctx.cart.items.push({ menuItemId: item.id, name: item.name, unitPrice: item.price, qty, ...(notes && { notes }) });
        return { ok: true, cart: cartForModel(ctx.cart) };
      },
    }),
    removeFromCart: tool({
      description: "Remove an item from the order, or lower its quantity.",
      inputSchema: z.object({
        itemId: z.string(),
        qty: z.number().int().min(1).optional().describe("How many to remove; omit to remove it completely"),
      }),
      execute: async ({ itemId, qty }) => {
        const index = ctx.cart.items.findIndex((l) => l.menuItemId === itemId);
        if (index === -1) return { ok: false, result: "That item isn't in the order." };
        const line = ctx.cart.items[index];
        if (qty && qty < line.qty) line.qty -= qty;
        else ctx.cart.items.splice(index, 1);
        return { ok: true, cart: cartForModel(ctx.cart) };
      },
    }),
    viewCart: tool({
      description: "See what's in the customer's order so far.",
      inputSchema: z.object({}),
      execute: async () => cartForModel(ctx.cart),
    }),
    setFulfillment: tool({
      description: "Record whether the order is for pickup or delivery. Delivery needs the customer's area and a landmark.",
      inputSchema: z.object({
        type: z.enum(["pickup", "delivery"]),
        area: z.string().max(200).optional().describe("Area and landmark for delivery, e.g. 'Ntinda, near Capital Shoppers'"),
      }),
      execute: async ({ type, area }) => {
        const d = ctx.restaurant.delivery;
        if (type === "delivery" && !d.delivery) return { ok: false, result: "This restaurant doesn't deliver. Offer pickup." };
        if (type === "pickup" && !d.pickup) return { ok: false, result: "This restaurant only delivers. Ask for their area." };
        if (type === "delivery" && !area?.trim()) return { ok: false, result: "Ask for the delivery area and a landmark first." };
        ctx.cart.fulfillment = type;
        ctx.cart.address = type === "delivery" ? area!.trim() : undefined;
        const known =
          type !== "delivery" || d.areas.length === 0 || d.areas.some((a) => area!.toLowerCase().includes(a.toLowerCase()));
        return {
          ok: true,
          ...(type === "delivery" && { deliveryFee: formatUgx(d.fee) }),
          ...(!known && { note: `This area isn't in the usual delivery list (${d.areas.join(", ")}). Mention the kitchen will confirm.` }),
        };
      },
    }),
    checkHours: tool({
      description: "Opening hours and whether the restaurant is open right now.",
      inputSchema: z.object({}),
      execute: async () => ({
        opens: ctx.restaurant.hours.open,
        closes: ctx.restaurant.hours.close,
        openNow: isOpenNow(ctx.restaurant),
        everyDay: true,
      }),
    }),
    sendMenu: tool({
      description: "Send the customer the menu as an image.",
      inputSchema: z.object({}),
      execute: async () => {
        ctx.effects.sendMenu = true;
        return { ok: true, note: "The menu image will be sent after your message. Don't list the whole menu in text." };
      },
    }),
  } satisfies Record<AgentToolName, unknown>;

  const chosen: ToolSet = {};
  for (const name of names) chosen[name] = all[name];

  // Always available: a person can take over from any stage.
  chosen.requestHuman = tool({
    description:
      "Hand the chat to restaurant staff. Use when the customer asks for a person, is upset or complaining, or needs something you can't do (refunds, special events, large catering orders).",
    inputSchema: z.object({ reason: z.string().max(200) }),
    execute: async ({ reason }) => {
      ctx.effects.handoff = reason;
      return { ok: true, note: "Staff have been notified. Don't say anything else; the handoff message is sent for you." };
    },
  });
  return chosen;
}

export function itemForModel(i: MenuItem) {
  return {
    itemId: i.id,
    name: i.name,
    ...(i.nameLg && { luganda: i.nameLg }),
    price: formatUgx(i.price),
    ...(!i.available && { soldOut: true }),
    ...(i.description && { description: i.description }),
  };
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Word-overlap match on names, Luganda names and aliases. Small menus, so no index needed. */
export function searchMenu(items: MenuItem[], query: string): MenuItem[] {
  const q = normalize(query);
  const qWords = q.split(" ").filter((w) => w.length > 1);
  const scored = items.map((item) => {
    const names = [item.name, item.nameLg ?? "", ...item.aliases].map(normalize);
    let score = 0;
    for (const n of names) {
      if (!n) continue;
      if (n === q) score += 10;
      else if (n.includes(q) || q.includes(n)) score += 5;
      for (const w of qWords) {
        if (n.split(" ").some((nw) => nw.length > 2 && w.length > 2 && (nw.startsWith(w) || w.startsWith(nw)))) score += 1;
      }
    }
    if (item.description && qWords.some((w) => normalize(item.description!).includes(w))) score += 0.5;
    return { item, score };
  });
  return scored
    .filter((s) => s.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((s) => s.item);
}
