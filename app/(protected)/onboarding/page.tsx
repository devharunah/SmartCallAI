import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { getMyRestaurant } from "@/lib/restaurants/current";
import { OnboardingForm } from "@/components/dashboard/onboarding-form";

export const metadata: Metadata = { title: `Set up your restaurant · ${BRAND.name}` };

export default async function OnboardingPage() {
  if (await getMyRestaurant()) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Step 1 of 2</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">Tell us about your restaurant</h1>
      <p className="mt-3 text-pretty text-muted-foreground">
        This is what your WhatsApp assistant tells customers. You can change all of it later in Settings.
      </p>
      <OnboardingForm />
    </div>
  );
}
