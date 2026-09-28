import type { ModelMessage } from "ai";
import { supabase } from "../supabase";
import type { Language } from "../restaurants/types";
import type { Cart, Conversation, ConversationStatus, DisplayEntry } from "./types";

// One row per customer per restaurant per channel. Each inbound message is its
// own request (a webhook or a simulator POST), so state is loaded and saved
// around every turn, like voice_sessions for phone calls.

interface ConversationRow {
  id: string;
  restaurant_id: string;
  channel: Conversation["channel"];
  customer_id: string;
  customer_name: string | null;
  language: Language;
  messages: ModelMessage[];
  display_log: DisplayEntry[];
  current_node: string | null;
  cart: Cart;
  misses: number;
  status: ConversationStatus;
  ai_paused: boolean;
  consent_shown: boolean;
  last_customer_at: string | null;
  updated_at: string;
}

export function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    channel: row.channel,
    customerId: row.customer_id,
    customerName: row.customer_name,
    language: row.language,
    messages: row.messages ?? [],
    displayLog: row.display_log ?? [],
    currentNode: row.current_node,
    cart: row.cart ?? { items: [] },
    misses: row.misses,
    status: row.status,
    aiPaused: row.ai_paused,
    consentShown: row.consent_shown,
    lastCustomerAt: row.last_customer_at,
    updatedAt: row.updated_at,
  };
}

export const CONVERSATION_COLUMNS =
  "id, restaurant_id, channel, customer_id, customer_name, language, messages, display_log, current_node, cart, misses, status, ai_paused, consent_shown, last_customer_at, updated_at";

/** Load the customer's conversation, creating it on first contact. Safe under retries. */
export async function getOrStartConversation({
  restaurantId,
  channel,
  customerId,
  customerName,
  language,
}: {
  restaurantId: string;
  channel: Conversation["channel"];
  customerId: string;
  customerName: string | null;
  language: Language;
}): Promise<Conversation> {
  const { error: upsertError } = await supabase
    .from("conversations")
    .upsert(
      { restaurant_id: restaurantId, channel, customer_id: customerId, customer_name: customerName, language },
      { onConflict: "restaurant_id,channel,customer_id", ignoreDuplicates: true }
    );
  if (upsertError) throw upsertError;

  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .eq("channel", channel)
    .eq("customer_id", customerId)
    .single();
  if (error) throw error;
  return toConversation(data as ConversationRow);
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase.from("conversations").select(CONVERSATION_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toConversation(data as ConversationRow) : null;
}

export type ConversationPatch = Partial<
  Pick<
    Conversation,
    | "customerName"
    | "language"
    | "messages"
    | "displayLog"
    | "currentNode"
    | "cart"
    | "misses"
    | "status"
    | "aiPaused"
    | "consentShown"
    | "lastCustomerAt"
  >
>;

/**
 * Save only if nobody else saved since we loaded (customers often send two
 * messages in a row). Returns false on a lost race so the caller can reload.
 */
export async function saveConversation(
  conversation: Conversation,
  patch: ConversationPatch,
  { force = false }: { force?: boolean } = {}
): Promise<boolean> {
  const row = {
    ...(patch.customerName !== undefined && { customer_name: patch.customerName }),
    ...(patch.language && { language: patch.language }),
    ...(patch.messages && { messages: trimHistory(patch.messages) }),
    ...(patch.displayLog && { display_log: patch.displayLog.slice(-200) }),
    ...(patch.currentNode !== undefined && { current_node: patch.currentNode }),
    ...(patch.cart && { cart: patch.cart }),
    ...(patch.misses !== undefined && { misses: patch.misses }),
    ...(patch.status && { status: patch.status }),
    ...(patch.aiPaused !== undefined && { ai_paused: patch.aiPaused }),
    ...(patch.consentShown !== undefined && { consent_shown: patch.consentShown }),
    ...(patch.lastCustomerAt !== undefined && { last_customer_at: patch.lastCustomerAt }),
    updated_at: new Date().toISOString(),
  };
  let query = supabase.from("conversations").update(row).eq("id", conversation.id);
  if (!force) query = query.eq("updated_at", conversation.updatedAt);
  const { data, error } = await query.select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Keep the model's context small: the last ~40 messages, starting at a user turn. */
function trimHistory(messages: ModelMessage[]): ModelMessage[] {
  if (messages.length <= 40) return messages;
  const tail = messages.slice(-40);
  const firstUser = tail.findIndex((m) => m.role === "user");
  return firstUser > 0 ? tail.slice(firstUser) : tail;
}
