import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { getMyRestaurant } from "@/lib/restaurants/current";
import { getMenu } from "@/lib/restaurants/data";
import { MenuEditor } from "@/components/dashboard/menu-editor";

export const metadata: Metadata = { title: `Menu · ${BRAND.name}` };

export default async function MenuPage() {
  const restaurant = (await getMyRestaurant())!;
  const db = await createClient();
  const [menu, assets] = await Promise.all([
    getMenu(db, restaurant.id),
    db.from("menu_assets").select("id, storage_path").eq("restaurant_id", restaurant.id).order("position"),
  ]);
  if (assets.error) throw assets.error;
  const photos = (assets.data ?? []).map((a) => ({
    id: a.id as string,
    url: db.storage.from("menus").getPublicUrl(a.storage_path as string).data.publicUrl,
  }));

  return <MenuEditor initialMenu={menu} initialPhotos={photos} generatedMenuUrl={`/api/menu-image/${restaurant.slug}`} />;
}
