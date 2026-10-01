"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMyRestaurant } from "@/lib/restaurants/current";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error: string | null; saved?: boolean };

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 07:30");
const Form = z.object({
  name: z.string().trim().min(2, "Enter the restaurant's name").max(80),
  defaultLanguage: z.enum(["lug", "eng"]),
  open: Time,
  close: Time,
  pickup: z.boolean(),
  delivery: z.boolean(),
  fee: z.coerce.number().int().min(0).max(1_000_000),
  areas: z.string().max(1000),
  greeting: z.string().trim().max(300),
  whatsappPhoneNumberId: z.string().trim().regex(/^\d{0,20}$/, "The phone number ID is digits only"),
});

export async function updateSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const restaurant = await getMyRestaurant();
  if (!restaurant) return { error: "Sign in again." };
  const parsed = Form.safeParse({
    name: formData.get("name"),
    defaultLanguage: formData.get("defaultLanguage"),
    open: formData.get("open"),
    close: formData.get("close"),
    pickup: formData.get("pickup") === "on",
    delivery: formData.get("delivery") === "on",
    fee: formData.get("fee") || 0,
    areas: formData.get("areas") ?? "",
    greeting: formData.get("greeting") ?? "",
    whatsappPhoneNumberId: formData.get("whatsappPhoneNumberId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const f = parsed.data;
  if (!f.pickup && !f.delivery) return { error: "Choose pickup, delivery or both." };

  const db = await createClient();
  const { error } = await db
    .from("restaurants")
    .update({
      name: f.name,
      default_language: f.defaultLanguage,
      hours: { open: f.open, close: f.close },
      delivery: {
        pickup: f.pickup,
        delivery: f.delivery,
        fee: f.delivery ? f.fee : 0,
        areas: f.areas.split(",").map((a) => a.trim()).filter(Boolean).slice(0, 40),
      },
      greeting: f.greeting || null,
      whatsapp_phone_number_id: f.whatsappPhoneNumberId || null,
    })
    .eq("id", restaurant.id);
  if (error?.code === "23505") return { error: "That WhatsApp number is already connected to another restaurant." };
  if (error) {
    console.error("[settings] update failed", error);
    return { error: "Couldn't save. Please try again." };
  }
  revalidatePath("/dashboard", "layout");
  return { error: null, saved: true };
}
