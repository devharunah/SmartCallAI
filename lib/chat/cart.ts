import { formatUgx } from "../restaurants/data";
import type { Language, Restaurant } from "../restaurants/types";
import { t } from "./language";
import type { Cart } from "./types";

// Prices here always come from menu_items rows copied into the cart by the
// addToCart tool, never from the model's text.

export function cartCount(cart: Cart): number {
  return cart.items.reduce((n, i) => n + i.qty, 0);
}

export function cartTotals(cart: Cart, restaurant: Pick<Restaurant, "delivery">) {
  const subtotal = cart.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const deliveryFee = cart.fulfillment === "delivery" ? restaurant.delivery.fee : 0;
  return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}

/** The order summary shown at the confirm step, in the customer's language. */
export function cartSummary(cart: Cart, restaurant: Restaurant, lang: Language): string {
  const { deliveryFee, total } = cartTotals(cart, restaurant);
  const lines = [t("confirmHeader", lang), ""];
  for (const i of cart.items) {
    lines.push(`${i.qty} × ${i.name}: ${formatUgx(i.unitPrice * i.qty)}${i.notes ? ` (${i.notes})` : ""}`);
  }
  if (cart.fulfillment === "delivery") {
    lines.push(`${t("deliveryLine", lang, { area: cart.address ?? "" })}: ${formatUgx(deliveryFee)}`);
  } else if (cart.fulfillment === "pickup") {
    lines.push(t("pickupLine", lang, { name: restaurant.name }));
  }
  lines.push(`*${t("totalLine", lang)}: ${formatUgx(total)}*`, "");
  lines.push(t(cart.fulfillment === "delivery" ? "payOnDelivery" : "payOnPickup", lang));
  lines.push(t("confirmPrompt", lang));
  return lines.join("\n");
}

/** A compact view of the cart for the model (no totals, so it can't misquote them). */
export function cartForModel(cart: Cart) {
  return {
    items: cart.items.map((i) => ({ itemId: i.menuItemId, name: i.name, qty: i.qty, notes: i.notes ?? null })),
    fulfillment: cart.fulfillment ?? null,
    address: cart.address ?? null,
  };
}
