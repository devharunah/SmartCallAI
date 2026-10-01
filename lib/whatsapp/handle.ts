import { supabase } from "../supabase";
import { getRestaurantBy } from "../restaurants/data";
import type { Language, Restaurant } from "../restaurants/types";
import { handleInbound } from "../chat/engine";
import { transcribeVoiceNote } from "../chat/transcribe";
import type { Inbound } from "../chat/types";
import { rateLimit } from "../rate-limit";
import { downloadMedia, markReadTyping, sendOut } from "./client";
import type { WhatsAppMessage } from "./webhook";

/** First sighting of this message id? Meta retries webhooks, so each wamid is handled once. */
export async function claimMessage(wamid: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("processed_messages")
    .upsert({ wamid }, { onConflict: "wamid", ignoreDuplicates: true })
    .select("wamid");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Which restaurant owns this WhatsApp number. Until each restaurant connects
 * its own number, our single number (WHATSAPP_PHONE_NUMBER_ID) answers for the
 * demo restaurant.
 */
async function restaurantFor(phoneNumberId: string): Promise<Restaurant | null> {
  const own = await getRestaurantBy(supabase, "whatsapp_phone_number_id", phoneNumberId);
  if (own) return own;
  if (phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return getRestaurantBy(supabase, "slug", process.env.DEMO_RESTAURANT_SLUG ?? "mama-rose-kitchen");
  }
  return null;
}

async function conversationLanguage(restaurant: Restaurant, customerId: string): Promise<Language> {
  const { data } = await supabase
    .from("conversations")
    .select("language")
    .eq("restaurant_id", restaurant.id)
    .eq("channel", "whatsapp")
    .eq("customer_id", customerId)
    .maybeSingle();
  return (data?.language as Language | undefined) ?? restaurant.defaultLanguage;
}

/** Everything after the 200: runs inside after(), so Meta isn't kept waiting. */
export async function processMessage(message: WhatsAppMessage): Promise<void> {
  const started = Date.now();
  const restaurant = await restaurantFor(message.phoneNumberId);
  if (!restaurant) {
    console.error(`[whatsapp] no restaurant for phone_number_id ${message.phoneNumberId}`);
    return;
  }
  if (!rateLimit(`wa:${message.from}`, 30, 10 * 60 * 1000)) {
    console.warn(`[whatsapp] rate limited ${message.from.slice(-4)}`);
    return;
  }
  markReadTyping(message.phoneNumberId, message.id).catch((err) => console.error("[whatsapp] markRead failed", err));

  let inbound: Inbound;
  const c = message.content;
  if (c.kind === "audio") {
    let text = "";
    try {
      const media = await downloadMedia(c.mediaId);
      const language = await conversationLanguage(restaurant, message.from);
      const result = await transcribeVoiceNote(media.bytes, media.mimeType || c.mimeType, language);
      text = result.text;
      console.log(`[whatsapp] voice note via ${result.provider} (${result.language ?? "?"})`);
    } catch (err) {
      console.error("[whatsapp] voice note failed", err);
    }
    inbound = { kind: "voice", text };
  } else if (c.kind === "button") {
    inbound = { kind: "button", text: c.title, buttonId: c.id };
  } else if (c.kind === "text" || c.kind === "location") {
    inbound = { kind: "text", text: c.text };
  } else {
    inbound = { kind: "text", text: `[The customer sent a ${c.type}, which you can't open. Ask them to type or send a voice note.]` };
  }

  const result = await handleInbound({
    restaurant,
    channel: "whatsapp",
    customerId: message.from,
    customerName: message.name,
    inbound,
  });
  await sendOut(message.phoneNumberId, message.from, result.out);
  console.log(
    `[whatsapp] ${restaurant.slug} ${message.from.slice(-4)} ${c.kind} → ${result.out.length} msg${result.orderReference ? ` order ${result.orderReference}` : ""} ${Date.now() - started}ms`
  );
}
