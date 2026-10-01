import type { ModelMessage } from "ai";
import type { Language } from "../restaurants/types";

/** What the engine asks a channel (WhatsApp, the web simulator) to send. */
export type OutMessage =
  | { type: "text"; text: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "buttons"; text: string; buttons: { id: string; title: string }[] };

/** What a customer sent, after voice notes are transcribed. */
export interface Inbound {
  kind: "text" | "voice" | "button";
  text: string;
  /** Reply-button id, when the customer tapped one. */
  buttonId?: string;
}

export interface CartLine {
  menuItemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  notes?: string;
}

export interface Cart {
  items: CartLine[];
  fulfillment?: "pickup" | "delivery";
  address?: string;
  notes?: string;
}

export type DisplayEntry =
  | { from: "customer"; at: string; kind: "text" | "voice" | "button"; text: string }
  | { from: "bot" | "staff"; at: string; message: OutMessage };

export type ConversationStatus = "active" | "handoff" | "closed";

export interface Conversation {
  id: string;
  restaurantId: string;
  channel: "whatsapp" | "web";
  customerId: string;
  customerName: string | null;
  language: Language;
  messages: ModelMessage[];
  displayLog: DisplayEntry[];
  currentNode: string | null;
  cart: Cart;
  misses: number;
  status: ConversationStatus;
  aiPaused: boolean;
  consentShown: boolean;
  lastCustomerAt: string | null;
  updatedAt: string;
}
