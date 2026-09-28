import type { SupabaseClient } from "@supabase/supabase-js";
import type { Menu, MenuCategory, MenuItem, Order, OrderItem, Restaurant } from "./types";

// Row mappers and queries shared by the chat engine (service role) and the
// dashboard (user session + RLS). Every function takes the client to use.

interface RestaurantRow {
  id: string;
  owner_id: string | null;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  default_language: Restaurant["defaultLanguage"];
  hours: Restaurant["hours"];
  delivery: Restaurant["delivery"];
  greeting: string | null;
  whatsapp_phone_number_id: string | null;
}

export function toRestaurant(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    currency: row.currency,
    timezone: row.timezone,
    defaultLanguage: row.default_language,
    hours: row.hours,
    delivery: row.delivery,
    greeting: row.greeting,
    whatsappPhoneNumberId: row.whatsapp_phone_number_id,
  };
}

const RESTAURANT_COLUMNS =
  "id, owner_id, name, slug, currency, timezone, default_language, hours, delivery, greeting, whatsapp_phone_number_id";

export async function getRestaurantBy(
  db: SupabaseClient,
  column: "id" | "slug" | "whatsapp_phone_number_id" | "owner_id",
  value: string
): Promise<Restaurant | null> {
  const { data, error } = await db
    .from("restaurants")
    .select(RESTAURANT_COLUMNS)
    .eq(column, value)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toRestaurant(data as RestaurantRow) : null;
}

interface MenuItemRow {
  id: string;
  category_id: string | null;
  name: string;
  name_lg: string | null;
  description: string | null;
  price: number;
  available: boolean;
  image_path: string | null;
  aliases: string[] | null;
  position: number;
}

export function toMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    nameLg: row.name_lg,
    description: row.description,
    price: row.price,
    available: row.available,
    imagePath: row.image_path,
    aliases: row.aliases ?? [],
    position: row.position,
  };
}

export async function getMenu(db: SupabaseClient, restaurantId: string): Promise<Menu> {
  const [cats, items] = await Promise.all([
    db.from("menu_categories").select("id, name, name_lg, position").eq("restaurant_id", restaurantId).order("position"),
    db
      .from("menu_items")
      .select("id, category_id, name, name_lg, description, price, available, image_path, aliases, position")
      .eq("restaurant_id", restaurantId)
      .order("position"),
  ]);
  if (cats.error) throw cats.error;
  if (items.error) throw items.error;
  return {
    categories: (cats.data ?? []).map(
      (c): MenuCategory => ({ id: c.id, name: c.name, nameLg: c.name_lg, position: c.position })
    ),
    items: (items.data as MenuItemRow[]).map(toMenuItem),
  };
}

export async function getMenuAssetPaths(db: SupabaseClient, restaurantId: string): Promise<string[]> {
  const { data, error } = await db
    .from("menu_assets")
    .select("storage_path")
    .eq("restaurant_id", restaurantId)
    .order("position");
  if (error) throw error;
  return (data ?? []).map((a) => a.storage_path as string);
}

interface OrderRow {
  id: string;
  reference: string;
  restaurant_id: string;
  conversation_id: string | null;
  channel: string;
  customer_name: string | null;
  customer_phone: string | null;
  fulfillment: Order["fulfillment"];
  address: string | null;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: Order["status"];
  payment_method: Order["paymentMethod"];
  payment_status: Order["paymentStatus"];
  created_at: string;
  order_items?: { menu_item_id: string | null; name_snapshot: string; unit_price: number; qty: number; notes: string | null }[];
}

export const ORDER_COLUMNS =
  "id, reference, restaurant_id, conversation_id, channel, customer_name, customer_phone, fulfillment, address, notes, subtotal, delivery_fee, total, status, payment_method, payment_status, created_at, order_items(menu_item_id, name_snapshot, unit_price, qty, notes)";

export function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    reference: row.reference,
    restaurantId: row.restaurant_id,
    conversationId: row.conversation_id,
    channel: row.channel,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    fulfillment: row.fulfillment,
    address: row.address,
    notes: row.notes,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    total: row.total,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    items: (row.order_items ?? []).map(
      (i): OrderItem => ({ menuItemId: i.menu_item_id, name: i.name_snapshot, unitPrice: i.unit_price, qty: i.qty, notes: i.notes })
    ),
  };
}

export function formatUgx(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString("en-US")}`;
}

/** Whether the restaurant is open now, in its own timezone. Handles closing after midnight. */
export function isOpenNow(restaurant: Pick<Restaurant, "hours" | "timezone">, now = new Date()): boolean {
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone: restaurant.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const { open, close } = restaurant.hours;
  if (open === close) return true; // 24h
  return open < close ? local >= open && local < close : local >= open || local < close;
}
