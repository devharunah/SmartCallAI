import { generateText, hasToolCall, isStepCount, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { formatUgx, isOpenNow } from "../restaurants/data";
import type { Language, Menu, Restaurant } from "../restaurants/types";
import { cartCount, cartForModel, cartSummary, cartTotals } from "../chat/cart";
import { t } from "../chat/language";
import { fallbackChatModel, primaryChatModel } from "../chat/model";
import { placeOrder } from "../chat/orders";
import { buildTools, type ToolEffects } from "../chat/tools";
import type { Cart, Conversation, Inbound, OutMessage } from "../chat/types";
import { evalExpr, type ExprContext } from "./expr";
import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from "./schema";

// Walks the restaurant's workflow for one inbound message. Agent stages call
// the LLM with their own instructions and tools plus a generated `goto` tool
// for their plain-language exits (the ElevenLabs approach: no extra LLM call to
// pick the next stage). Fixed stages (send menu, confirm, place order, handoff)
// run in code, so prices and order creation never depend on the model.

const MAX_HOPS = 8;

export interface RuntimeInput {
  restaurant: Restaurant;
  menu: Menu;
  graph: WorkflowGraph;
  conversation: Conversation;
  inbound: Inbound;
  menuImageUrls: string[];
}

export interface RuntimeResult {
  out: OutMessage[];
  /** Assistant-side history to append after the user's message. */
  newMessages: ModelMessage[];
  currentNode: string | null;
  cart: Cart;
  handoff: string | null;
  orderReference: string | null;
  trace: string[];
}

export async function runWorkflow(input: RuntimeInput): Promise<RuntimeResult> {
  const { restaurant, graph, conversation, inbound } = input;
  const lang = conversation.language;
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const start = graph.nodes.find((n) => n.type === "start")!;
  const handoffNode = graph.nodes.find((n) => n.type === "handoff") ?? null;

  const cart: Cart = structuredClone(conversation.cart ?? { items: [] });
  const history: ModelMessage[] = [...conversation.messages, { role: "user", content: userContent(inbound) }];
  const newMessages: ModelMessage[] = [];
  const out: OutMessage[] = [];
  const trace: string[] = [];
  let handoff: string | null = null;
  let orderReference: string | null = null;

  // The customer's message until some stage has answered it.
  let pending: Inbound | null = inbound;
  let node: WorkflowNode = (conversation.currentNode && nodes.get(conversation.currentNode)) || start;
  let justEntered = !conversation.currentNode || !nodes.has(conversation.currentNode);

  const say = (message: OutMessage) => {
    out.push(message);
    const text = message.type === "image" ? `[sent image: ${message.caption ?? "menu"}]` : message.text;
    const entry: ModelMessage = { role: "assistant", content: text };
    history.push(entry);
    newMessages.push(entry);
  };
  const exprContext = (): ExprContext => ({
    "cart.count": cartCount(cart),
    "cart.total": cartTotals(cart, restaurant).total,
    isOpen: isOpenNow(restaurant),
    fulfillment: cart.fulfillment ?? null,
    hasAddress: Boolean(cart.address),
    language: lang,
  });
  const edgesFrom = (id: string) => graph.edges.filter((e) => e.source === id);
  const follow = (kinds: WorkflowEdge["kind"][]): WorkflowNode | null => {
    for (const kind of kinds) {
      for (const e of edgesFrom(node.id).filter((e) => e.kind === kind)) {
        if (kind === "expr" && !safeEval(e.condition ?? "", exprContext())) continue;
        const target = nodes.get(e.target);
        if (target) return target;
      }
    }
    return null;
  };
  const moveTo = (target: WorkflowNode | null) => {
    if (!target) return false;
    node = target;
    justEntered = true;
    return true;
  };

  let hops = 0;
  for (; hops < MAX_HOPS; hops++) {
    trace.push(node.id);

    if (node.type === "start") {
      if (!moveTo(follow(["expr", "always", "success"]))) break;
      continue;
    }

    if (node.type === "agent") {
      if (!pending) {
        // Arrived with nothing left to answer: say the stage's opener, if any, and wait.
        const opener = node.data.say?.[lang] ?? node.data.say?.eng;
        if (justEntered && opener) say({ type: "text", text: opener });
        break;
      }
      const result = await runAgent({ ...input, node, cart, history, lang, llmEdges: edgesFrom(node.id).filter((e) => e.kind === "llm") });
      if (result.effects.handoff && handoffNode) {
        handoff = result.effects.handoff;
        moveTo(handoffNode);
        continue;
      }
      if (result.gotoTarget) {
        // The next stage answers the same message; this stage's words are dropped.
        const target = nodes.get(result.gotoTarget)!;
        if (target.type !== "agent") pending = null;
        moveTo(target);
        continue;
      }
      if (result.text) {
        out.push({ type: "text", text: result.text });
        history.push(...result.responseMessages);
        newMessages.push(...result.responseMessages);
      }
      if (result.effects.sendMenu) sendMenuImages(input, lang, say);
      else if (!result.text) say({ type: "text", text: t("somethingWrong", lang) });
      pending = null;
      justEntered = false;
      if (moveTo(follow(["expr", "always"]))) continue;
      break;
    }

    if (node.type === "send_menu") {
      sendMenuImages(input, lang, say);
      const text = node.data.say?.[lang] ?? node.data.say?.eng;
      if (text) say({ type: "text", text });
      pending = null;
      if (!moveTo(follow(["always", "success", "expr"]))) break;
      continue;
    }

    if (node.type === "confirm") {
      const failure = follow(["failure"]);
      if (justEntered || !pending) {
        if (cart.items.length === 0 || !cart.fulfillment || (cart.fulfillment === "delivery" && !cart.address)) {
          say({ type: "text", text: t(cart.items.length === 0 ? "emptyCart" : "needFulfillment", lang) });
          pending = null;
          if (!moveTo(failure)) break;
          justEntered = false; // wait at the order stage without an opener
          continue;
        }
        say({
          type: "buttons",
          text: cartSummary(cart, restaurant, lang),
          buttons: [
            { id: "confirm_yes", title: t("confirmYes", lang) },
            { id: "confirm_change", title: t("confirmChange", lang) },
          ],
        });
        justEntered = false;
        break; // wait for yes / change
      }
      if (confirmDecision(pending) === "yes") {
        pending = null;
        if (!moveTo(follow(["success"]))) break;
        continue;
      }
      // "No", "change", or something like "add a soda too": let the order stage handle it.
      if (pending.buttonId === "confirm_change") pending = { kind: "text", text: pending.text };
      if (!moveTo(failure)) break;
      continue;
    }

    if (node.type === "place_order") {
      const result = await placeOrder(restaurant, conversation, cart);
      if (result.ok) {
        orderReference = result.reference;
        say({ type: "text", text: t("orderPlaced", lang, { ref: result.reference, total: formatUgx(result.total) }) });
        cart.items = [];
        cart.notes = undefined;
        pending = null;
        if (!moveTo(follow(["success", "always"]))) break;
        justEntered = false;
        continue;
      }
      if (result.reason === "unavailable") {
        for (const name of result.unavailable ?? []) {
          say({ type: "text", text: t("itemGone", lang, { item: name }) });
          cart.items = cart.items.filter((i) => i.name !== name);
        }
      } else {
        say({ type: "text", text: t(result.reason === "empty" ? "emptyCart" : result.reason === "no_fulfillment" ? "needFulfillment" : "somethingWrong", lang) });
      }
      pending = null;
      if (!moveTo(follow(["failure"]))) break;
      justEntered = false;
      continue;
    }

    if (node.type === "handoff") {
      handoff = handoff ?? "The customer asked for a person";
      say({ type: "text", text: node.data.say?.[lang] ?? t("handoff", lang) });
      break;
    }

    if (node.type === "end") {
      const text = node.data.say?.[lang] ?? node.data.say?.eng;
      if (text) say({ type: "text", text });
      trace.push("(restart)");
      return { out, newMessages, currentNode: null, cart, handoff, orderReference, trace };
    }
  }

  if (hops >= MAX_HOPS) console.warn("[workflow] hop limit reached", trace.join(" → "));
  if (out.length === 0 && pending) say({ type: "text", text: t("somethingWrong", lang) });
  return { out, newMessages, currentNode: node.id, cart, handoff, orderReference, trace };
}

function userContent(inbound: Inbound): string {
  if (inbound.kind === "voice") return `[voice note] ${inbound.text}`;
  return inbound.text;
}

function safeEval(condition: string, ctx: ExprContext): boolean {
  try {
    return evalExpr(condition, ctx);
  } catch {
    return false; // saved graphs are validated; ignore a bad condition rather than crash the chat
  }
}

const YES = /^(y|yes|yeah|yep|yup|ok|okay|sure|confirm|go ahead|place it|yee|ye|yegwe|kale|weewaawo|kakasa|kituufu|awo)\b/i;
function confirmDecision(inbound: Inbound): "yes" | "other" {
  if (inbound.buttonId === "confirm_yes") return "yes";
  if (inbound.buttonId === "confirm_change") return "other";
  const text = inbound.text.trim().replace(/[!.👍✅🙏\s]+$/u, "");
  return YES.test(text) && text.split(/\s+/).length <= 4 ? "yes" : "other";
}

function sendMenuImages(input: RuntimeInput, lang: Language, say: (m: OutMessage) => void) {
  const caption = t("menuCaption", lang, { name: input.restaurant.name });
  for (const url of input.menuImageUrls) say({ type: "image", url, caption });
}

interface AgentRun {
  text: string;
  gotoTarget: string | null;
  effects: ToolEffects;
  responseMessages: ModelMessage[];
}

async function runAgent({
  restaurant,
  menu,
  node,
  cart,
  history,
  lang,
  llmEdges,
  graph,
}: RuntimeInput & {
  node: WorkflowNode;
  cart: Cart;
  history: ModelMessage[];
  lang: Language;
  llmEdges: WorkflowEdge[];
}): Promise<AgentRun> {
  const effects: ToolEffects = { sendMenu: false, handoff: null };
  const cartBefore = structuredClone(cart);
  let gotoTarget: string | null = null;

  const tools = buildTools(node.data.tools ?? [], { restaurant, menu, cart, effects });
  if (llmEdges.length > 0) {
    const titles = new Map(graph.nodes.map((n) => [n.id, n.title]));
    tools.goto = tool({
      description: [
        "Move the conversation to another stage when one of these is true. The next stage will reply to the customer, so don't write a reply yourself.",
        ...llmEdges.map((e) => `- "${e.id}": ${e.condition} (goes to ${titles.get(e.target)})`),
      ].join("\n"),
      inputSchema: z.object({ edge: z.enum(llmEdges.map((e) => e.id) as [string, ...string[]]) }),
      execute: async ({ edge }) => {
        gotoTarget = llmEdges.find((e) => e.id === edge)?.target ?? null;
        return { ok: true };
      },
    });
  }

  const instructions = systemPrompt(restaurant, menu, node, cart, lang, llmEdges.length > 0);
  const call = (model: ReturnType<typeof fallbackChatModel>, timeoutMs: number) =>
    generateText({
      model: model.model,
      instructions,
      messages: history,
      tools,
      stopWhen: [isStepCount(6), hasToolCall("goto"), hasToolCall("requestHuman")],
      maxOutputTokens: 400,
      temperature: 0.4,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });

  const primary = primaryChatModel();
  let result;
  try {
    result = await call(primary ?? fallbackChatModel(), primary ? 12_000 : 20_000);
  } catch (err) {
    if (!primary) throw err;
    console.error(`[workflow] ${primary.label} failed, retrying with fallback`, err);
    // Undo any cart changes from the failed attempt before retrying.
    cart.items = cartBefore.items;
    cart.fulfillment = cartBefore.fulfillment;
    cart.address = cartBefore.address;
    effects.sendMenu = false;
    effects.handoff = null;
    gotoTarget = null;
    result = await call(fallbackChatModel(), 15_000);
  }

  return { text: result.text.trim(), gotoTarget, effects, responseMessages: result.responseMessages };
}

function systemPrompt(
  restaurant: Restaurant,
  menu: Menu,
  node: WorkflowNode,
  cart: Cart,
  lang: Language,
  canMove: boolean
): string {
  const d = restaurant.delivery;
  const categories = new Map(menu.categories.map((c) => [c.id, c.name]));
  const menuLines = menu.items
    .slice(0, 150)
    .map(
      (i) =>
        `${i.id} | ${i.name}${i.nameLg ? ` (${i.nameLg})` : ""} | ${formatUgx(i.price)} | ${categories.get(i.categoryId ?? "") ?? "Other"}${
          i.available ? "" : " | SOLD OUT"
        }${i.aliases.length ? ` | also called: ${i.aliases.join(", ")}` : ""}`
    )
    .join("\n");

  return `You are the WhatsApp ordering assistant for ${restaurant.name}, a restaurant in Kampala, Uganda.${
    restaurant.greeting ? ` The owner says: "${restaurant.greeting}"` : ""
  }

Rules (always):
- Only help with this restaurant: its menu, orders, hours, delivery and payment. Politely decline anything else (general knowledge, homework, coding, news, other businesses) in one sentence and steer back to food.
- Never invent menu items, prices, discounts, delivery times or promises. Use only the menu below and tool results.
- Never state an order total. The confirmation step shows the prices.
- WhatsApp style: short and friendly, one to three sentences, at most one emoji, no headings or tables. Don't greet again once the chat has started.
- Language: reply in the language of the customer's latest message. If they write Luganda, reply in natural, simple Luganda as spoken in Kampala (English food names and words like "order" are fine). If they mix Luganda and English, you may mix too. The conversation's language so far: ${lang === "lug" ? "Luganda" : "English"}.
- Messages starting with [voice note] were transcribed from speech and may have errors. If something is unclear, ask.
- If the customer wants a person, is upset, or needs something you can't do, call requestHuman.

Restaurant facts:
- Open ${restaurant.hours.open} to ${restaurant.hours.close} every day (Kampala time). Right now it is ${isOpenNow(restaurant) ? "open" : "CLOSED"}.
- Pickup: ${d.pickup ? "yes" : "no"}. Delivery: ${d.delivery ? `yes, fee ${formatUgx(d.fee)}${d.areas.length ? `, areas: ${d.areas.join(", ")}` : ""}` : "no"}.
- Payment: cash or mobile money (MTN MoMo, Airtel Money) on delivery or pickup.

Menu (itemId | name | price | category):
${menuLines}

Current order: ${JSON.stringify(cartForModel(cart))}

Current stage: ${node.title}
${node.data.prompt ?? ""}${
    canMove
      ? "\n\nWhen one of the goto conditions is true, call goto instead of replying. Do the stage's tool calls (like addToCart) first if the customer's message needs them."
      : ""
  }`;
}
