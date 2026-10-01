import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { getMyRestaurant } from "@/lib/restaurants/current";
import { ORDER_COLUMNS, toOrder } from "@/lib/restaurants/data";
import { OrdersBoard } from "@/components/dashboard/orders-board";

export const metadata: Metadata = { title: `Orders · ${BRAND.name}` };

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

export default async function OrdersPage() {
  const restaurant = (await getMyRestaurant())!;
  const db = await createClient();
  const since = hoursAgo(36);
  const { data, error } = await db
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("restaurant_id", restaurant.id)
    .or(`created_at.gte.${since},status.in.(new,accepted,preparing,ready)`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  return <OrdersBoard restaurantId={restaurant.id} initialOrders={(data ?? []).map(toOrder)} />;
}
