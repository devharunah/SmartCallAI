import type { ModelMessage } from "ai";
import type { Language } from "../restaurants/types";
import type { Cart, Conversation, ConversationStatus, DisplayEntry } from "./types";

// Row mapping shared by server code and the dashboard's browser code (Realtime
// payloads), so it must not import the service-role client.

export interface ConversationRow {
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
