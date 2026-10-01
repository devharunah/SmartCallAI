import { supabase } from "../supabase";
import { getRestaurantBy } from "../restaurants/data";
import type { Order, OrderStatus } from "../restaurants/types";
import { isWhatsAppConfigured, sendOut } from "../whatsapp/client";
import { getConversation, saveConversation } from "./conversations";
import { t, type StringKey } from "./language";
import type { DisplayEntry, OutMessage } from "./types";

// Messages the restaurant sends outside the bot's reply: order status updates
// and staff replies from the inbox. WhatsApp only allows free-form messages
// within 24 hours of the customer's last message; after that it needs a paid,
// pre-approved template (later phase), so we skip and say so.

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type NotifyResult = { sent: true } | { sent: false; reason: "window_closed" | "not_configured" | "no_conversation" | "failed" };

export async function sendToConversation(
  conversationId: string,
  messages: OutMessage[],
  from: "bot" | "staff"
): Promise<NotifyResult> {
  const conversation = await getConversation(conversationId);
  if (!conversation) return { sent: false, reason: "no_conversation" };

  if (conversation.channel === "whatsapp") {
    const lastAt = conversation.lastCustomerAt ? Date.parse(conversation.lastCustomerAt) : 0;
    if (Date.now() - lastAt > WINDOW_MS) return { sent: false, reason: "window_closed" };
    if (!isWhatsAppConfigured()) return { sent: false, reason: "not_configured" };
    const restaurant = await getRestaurantBy(supabase, "id", conversation.restaurantId);
    const phoneNumberId = restaurant?.whatsappPhoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!phoneNumberId) return { sent: false, reason: "not_configured" };
    try {
      await sendOut(phoneNumberId, conversation.customerId, messages);
    } catch (err) {
      console.error("[notify] WhatsApp send failed", err);
      return { sent: false, reason: "failed" };
    }
  }
  // Web (simulator) conversations just get it in the log.

  const at = new Date().toISOString();
  const entries: DisplayEntry[] = messages.map((message) => ({ from, at, message }));
  const text = messages.map((m) => (m.type === "image" ? "[image]" : m.text)).join("\n");
  const patch = {
    displayLog: [...conversation.displayLog, ...entries],
    messages: [...conversation.messages, { role: "assistant" as const, content: from === "staff" ? `[staff] ${text}` : text }],
  };
  if (!(await saveConversation(conversation, patch))) {
    const latest = await getConversation(conversationId);
    if (latest) {
      await saveConversation(
        latest,
        { displayLog: [...latest.displayLog, ...entries], messages: [...latest.messages, ...patch.messages.slice(-1)] },
        { force: true }
      );
    }
  }
  return { sent: true };
}

const STATUS_KEY: Partial<Record<OrderStatus, (o: Order) => StringKey>> = {
  accepted: () => "status_accepted",
  preparing: () => "status_preparing",
  ready: (o) => (o.fulfillment === "delivery" ? "status_ready_delivery" : "status_ready_pickup"),
  completed: () => "status_completed",
  cancelled: () => "status_cancelled",
};

/** Tell the customer their order moved, in their language. */
export async function notifyOrderStatus(order: Order): Promise<NotifyResult | null> {
  const key = STATUS_KEY[order.status]?.(order);
  if (!key || !order.conversationId) return null;
  const conversation = await getConversation(order.conversationId);
  if (!conversation) return { sent: false, reason: "no_conversation" };
  return sendToConversation(order.conversationId, [{ type: "text", text: t(key, conversation.language, { ref: order.reference }) }], "bot");
}
