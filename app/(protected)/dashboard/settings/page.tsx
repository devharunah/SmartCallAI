import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { getMyRestaurant } from "@/lib/restaurants/current";
import { isWhatsAppConfigured } from "@/lib/whatsapp/client";
import { SettingsForm } from "@/components/dashboard/settings-form";

export const metadata: Metadata = { title: `Settings · ${BRAND.name}` };

export default async function SettingsPage() {
  const restaurant = (await getMyRestaurant())!;
  return (
    <SettingsForm
      restaurant={restaurant}
      whatsapp={{
        configured: isWhatsAppConfigured(),
        webhookUrl: `${process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "https://<your-domain>"}/api/whatsapp/webhook`,
      }}
    />
  );
}
