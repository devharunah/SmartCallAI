import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { getMyRestaurant } from "@/lib/restaurants/current";
import { CONVERSATION_COLUMNS, toConversation } from "@/lib/chat/conversation-row";
import { Inbox } from "@/components/dashboard/inbox";

export const metadata: Metadata = { title: `Inbox · ${BRAND.name}` };

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const restaurant = (await getMyRestaurant())!;
  const { c } = await searchParams;
  const db = await createClient();
  const { data, error } = await db
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("restaurant_id", restaurant.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const conversations = (data ?? []).map((row) => toConversation(row as Parameters<typeof toConversation>[0]));
  return <Inbox restaurantId={restaurant.id} initial={conversations} selectedId={c ?? conversations[0]?.id ?? null} />;
}
