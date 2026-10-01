"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getClaims } from "@/lib/auth";
import { supabase as serviceDb } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { getMenu, getRestaurantBy } from "@/lib/restaurants/data";

export type OnboardingState = { error: string | null };

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 07:30");
const Form = z.object({
  name: z.string().trim().min(2, "Enter your restaurant's name").max(80),
  defaultLanguage: z.enum(["lug", "eng"]),
  open: Time,
  close: Time,
  pickup: z.boolean(),
  delivery: z.boolean(),
  fee: z.coerce.number().int().min(0).max(1_000_000),
  areas: z.string().max(1000),
  sampleMenu: z.boolean(),
});

function slugify(name: string) {
  const base = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "restaurant";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function createRestaurant(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const claims = await getClaims();
  if (!claims) redirect("/login?next=/onboarding");

  const parsed = Form.safeParse({
    name: formData.get("name"),
    defaultLanguage: formData.get("defaultLanguage"),
    open: formData.get("open"),
    close: formData.get("close"),
    pickup: formData.get("pickup") === "on",
    delivery: formData.get("delivery") === "on",
    fee: formData.get("fee") || 0,
    areas: formData.get("areas") ?? "",
    sampleMenu: formData.get("sampleMenu") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const f = parsed.data;
  if (!f.pickup && !f.delivery) return { error: "Choose pickup, delivery or both." };

  const db = await createClient();
  if (await getRestaurantBy(db, "owner_id", claims.sub)) redirect("/dashboard");

  const { data: restaurant, error } = await db
    .from("restaurants")
    .insert({
      owner_id: claims.sub,
      name: f.name,
      slug: slugify(f.name),
      default_language: f.defaultLanguage,
      hours: { open: f.open, close: f.close },
      delivery: {
        pickup: f.pickup,
        delivery: f.delivery,
        fee: f.delivery ? f.fee : 0,
        areas: f.areas.split(",").map((a) => a.trim()).filter(Boolean).slice(0, 40),
      },
    })
    .select("id")
    .single();
  if (error) {
    console.error("[onboarding] create restaurant failed", error);
    return { error: "Couldn't create your restaurant. Please try again." };
  }

  if (f.sampleMenu) {
    try {
      await copySampleMenu(db, restaurant.id);
    } catch (err) {
      // Not fatal: the owner can add items on the Menu page.
      console.error("[onboarding] sample menu copy failed", err);
    }
  }
  redirect("/dashboard");
}

/** Copy the demo restaurant's menu so a new owner can try the bot straight away. */
async function copySampleMenu(db: Awaited<ReturnType<typeof createClient>>, restaurantId: string) {
  const demo = await getRestaurantBy(serviceDb, "slug", process.env.DEMO_RESTAURANT_SLUG ?? "mama-rose-kitchen");
  if (!demo) return;
  const menu = await getMenu(serviceDb, demo.id);
  const idMap = new Map<string, string>();
  for (const c of menu.categories) {
    const { data, error } = await db
      .from("menu_categories")
      .insert({ restaurant_id: restaurantId, name: c.name, name_lg: c.nameLg, position: c.position })
      .select("id")
      .single();
    if (error) throw error;
    idMap.set(c.id, data.id);
  }
  const { error } = await db.from("menu_items").insert(
    menu.items.map((i) => ({
      restaurant_id: restaurantId,
      category_id: i.categoryId ? idMap.get(i.categoryId) ?? null : null,
      name: i.name,
      name_lg: i.nameLg,
      description: i.description,
      price: i.price,
      available: i.available,
      aliases: i.aliases,
      position: i.position,
    }))
  );
  if (error) throw error;
}
