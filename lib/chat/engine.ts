import { createHash } from "node:crypto";
import type { ModelMessage } from "ai";
import { supabase } from "../supabase";
import { getMenu, getMenuAssetPaths } from "../restaurants/data";
import type { Menu, Restaurant } from "../restaurants/types";
import { runWorkflow, type RuntimeResult } from "../workflow/runtime";
import { getWorkflow } from "../workflow/store";
import { getConversation, getOrStartConversation, saveConversation, type ConversationPatch } from "./conversations";
import { detectLanguage, t } from "./language";
import type { Conversation, DisplayEntry, Inbound, OutMessage } from "./types";

// One inbound customer message in, the replies out. Knows nothing about
// WhatsApp or the browser: each channel turns its payload into `Inbound` and
// sends the returned `OutMessage`s its own way.

const MAX_MISSES = 2; // unreadable voice notes in a row before a person takes over

export interface EngineResult {
  out: OutMessage[];
  conversation: Conversation;
  orderReference: string | null;
  handoff: boolean;
}

export async function handleInbound({
  restaurant,
  channel,
  customerId,
  customerName,
  inbound,
}: {
  restaurant: Restaurant;
  channel: Conversation["channel"];
  customerId: string;
  customerName: string | null;
  inbound: Inbound;
}): Promise<EngineResult> {
  const conversation = await getOrStartConversation({
    restaurantId: restaurant.id,
    channel,
    customerId,
    customerName,
    language: restaurant.defaultLanguage,
  });

  const now = new Date().toISOString();
  const language = (inbound.kind !== "button" && detectLanguage(inbound.text)) || conversation.language;
  const convo: Conversation = { ...conversation, language, customerName: customerName ?? conversation.customerName };
  const customerEntry: DisplayEntry = { from: "customer", at: now, kind: inbound.kind, text: inbound.text };
  const base: ConversationPatch = {
    language,
    customerName: convo.customerName,
    lastCustomerAt: now,
    // A closed conversation starts over when the customer writes again.
    ...(conversation.status === "closed" && { status: "active", currentNode: null }),
  };

  // Staff have taken over: record the message for the inbox and stay quiet.
  if (conversation.aiPaused) {
    await persist(convo, { ...base }, [customerEntry], [], [{ role: "user", content: inbound.text }]);
    return { out: [], conversation: convo, orderReference: null, handoff: true };
  }

  const out: OutMessage[] = [];
  if (!conversation.consentShown) out.push({ type: "text", text: t("consent", language, { name: restaurant.name }) });

  // A voice note we couldn't transcribe.
  if (!inbound.text.trim()) {
    const misses = conversation.misses + 1;
    const giveUp = misses > MAX_MISSES;
    out.push({ type: "text", text: t(giveUp ? "handoff" : "voiceNotUnderstood", language) });
    await persist(
      convo,
      { ...base, misses, consentShown: true, ...(giveUp && { aiPaused: true, status: "handoff" as const }) },
      [customerEntry],
      out,
      []
    );
    return { out, conversation: convo, orderReference: null, handoff: giveUp };
  }

  const [menu, workflow, menuImageUrls] = await Promise.all([
    getMenu(supabase, restaurant.id),
    getWorkflow(supabase, restaurant.id),
    menuImages(restaurant),
  ]);

  let result: RuntimeResult;
  try {
    result = await runWorkflow({
      restaurant,
      menu,
      graph: workflow.graph,
      conversation: conversation.status === "closed" ? { ...convo, currentNode: null } : convo,
      inbound,
      menuImageUrls: menuImageUrls.length ? menuImageUrls : [generatedMenuUrl(restaurant, menu)],
    });
  } catch (err) {
    console.error("[chat/engine] workflow failed", err);
    out.push({ type: "text", text: t("somethingWrong", language) });
    await persist(convo, { ...base, consentShown: true }, [customerEntry], out, []);
    return { out, conversation: convo, orderReference: null, handoff: false };
  }

  console.log(`[chat/engine] ${restaurant.slug} ${channel}:${customerId.slice(-6)} ${result.trace.join(" → ")}`);
  out.push(...result.out);
  await persist(
    convo,
    {
      ...base,
      consentShown: true,
      misses: 0,
      currentNode: result.currentNode,
      cart: result.cart,
      ...(result.handoff && { aiPaused: true, status: "handoff" as const }),
    },
    [customerEntry],
    out,
    [{ role: "user", content: inbound.kind === "voice" ? `[voice note] ${inbound.text}` : inbound.text }, ...result.newMessages]
  );
  return { out, conversation: convo, orderReference: result.orderReference, handoff: Boolean(result.handoff) };
}

/**
 * Append this turn to the conversation. If another message was saved while
 * this one ran (customers send bursts), reload and append onto the newer row
 * instead of overwriting it; the runtime is not re-run, so an order is never
 * placed twice.
 */
async function persist(
  conversation: Conversation,
  patch: ConversationPatch,
  customerEntries: DisplayEntry[],
  out: OutMessage[],
  modelMessages: ModelMessage[]
) {
  const at = new Date().toISOString();
  const botEntries: DisplayEntry[] = out.map((message) => ({ from: "bot", at, message }));
  const build = (c: Conversation): ConversationPatch => ({
    ...patch,
    displayLog: [...c.displayLog, ...customerEntries, ...botEntries],
    messages: [...c.messages, ...modelMessages],
  });
  if (await saveConversation(conversation, build(conversation))) return;
  const latest = await getConversation(conversation.id);
  if (!latest) return;
  await saveConversation(latest, build(latest), { force: true });
}

/** Public URLs of the owner's uploaded menu images. */
export async function menuImages(restaurant: Restaurant): Promise<string[]> {
  const paths = await getMenuAssetPaths(supabase, restaurant.id);
  return paths.map((p) => supabase.storage.from("menus").getPublicUrl(p).data.publicUrl);
}

/** A menu image drawn from the menu table; the hash changes whenever prices or availability change. */
export function generatedMenuUrl(restaurant: Restaurant, menu: Menu): string {
  const v = createHash("sha1")
    .update(JSON.stringify(menu.items.map((i) => [i.name, i.price, i.available])))
    .digest("hex")
    .slice(0, 10);
  return `/api/menu-image/${restaurant.slug}?v=${v}`;
}
