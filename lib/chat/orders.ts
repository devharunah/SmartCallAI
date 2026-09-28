import { BRAND } from "../brand";
import { supabase } from "../supabase";
import type { Restaurant } from "../restaurants/types";
import { cartTotals } from "./cart";
import type { Cart, Conversation } from "./types";

export type PlaceOrderResult =
  | { ok: true; orderId: string; reference: string; total: number }
  | { ok: false; reason: "empty" | "no_fulfillment" | "unavailable" | "error"; unavailable?: string[] };

/**
 * Turn the cart into an order. Prices are re-read from menu_items so the
 * kitchen and the customer see the current price, and sold-out items are caught.
 */
export async function placeOrder(restaurant: Restaurant, conversation: Conversation, cart: Cart): Promise<PlaceOrderResult> {
  if (cart.items.length === 0) return { ok: false, reason: "empty" };
  if (!cart.fulfillment || (cart.fulfillment === "delivery" && !cart.address)) return { ok: false, reason: "no_fulfillment" };

  const { data: rows, error } = await supabase
    .from("menu_items")
    .select("id, name, price, available")
    .eq("restaurant_id", restaurant.id)
    .in("id", cart.items.map((i) => i.menuItemId));
  if (error) throw error;
  const live = new Map((rows ?? []).map((r) => [r.id as string, r]));
  const unavailable = cart.items.filter((i) => !live.get(i.menuItemId)?.available).map((i) => i.name);
  if (unavailable.length) return { ok: false, reason: "unavailable", unavailable };

  const priced: Cart = { ...cart, items: cart.items.map((i) => ({ ...i, unitPrice: live.get(i.menuItemId)!.price })) };
  const { subtotal, deliveryFee, total } = cartTotals(priced, restaurant);

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = `${BRAND.orderPrefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        reference,
        restaurant_id: restaurant.id,
        conversation_id: conversation.id,
        channel: conversation.channel,
        customer_name: conversation.customerName,
        customer_phone: conversation.channel === "whatsapp" ? `+${conversation.customerId}` : null,
        fulfillment: cart.fulfillment,
        address: cart.fulfillment === "delivery" ? cart.address : null,
        notes: cart.notes ?? null,
        subtotal,
        delivery_fee: deliveryFee,
        total,
      })
      .select("id")
      .single();
    if (insertError?.code === "23505") continue; // reference collision, try another
    if (insertError) throw insertError;

    const { error: itemsError } = await supabase.from("order_items").insert(
      priced.items.map((i) => ({
        order_id: order.id,
        menu_item_id: i.menuItemId,
        name_snapshot: i.name,
        unit_price: i.unitPrice,
        qty: i.qty,
        notes: i.notes ?? null,
      }))
    );
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }
    return { ok: true, orderId: order.id, reference, total };
  }
  return { ok: false, reason: "error" };
}
