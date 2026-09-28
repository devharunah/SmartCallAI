"use client";

import { useActionState } from "react";
import { createRestaurant, type OnboardingState } from "@/app/(protected)/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: OnboardingState = { error: null };

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createRestaurant, initial);

  return (
    <form action={action} className="mt-8 space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Restaurant name</Label>
        <Input id="name" name="name" required maxLength={80} placeholder="e.g. Mama Rose Kitchen" autoComplete="organization" />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Main language of your customers</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          {[
            { value: "lug", label: "Luganda" },
            { value: "eng", label: "English" },
          ].map((o) => (
            <label key={o.value} className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-[:checked]:border-foreground">
              <input type="radio" name="defaultLanguage" value={o.value} defaultChecked={o.value === "lug"} className="accent-foreground" />
              {o.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">The assistant always answers in whichever language each customer writes in.</p>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="open">Opens</Label>
          <Input id="open" name="open" type="time" defaultValue="08:00" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="close">Closes</Label>
          <Input id="close" name="close" type="time" defaultValue="22:00" required />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">How customers get their food</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="pickup" defaultChecked className="size-4 accent-foreground" /> Pickup
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="delivery" defaultChecked className="size-4 accent-foreground" /> Delivery
        </label>
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="fee">Delivery fee (UGX)</Label>
            <Input id="fee" name="fee" type="number" inputMode="numeric" min={0} step={500} defaultValue={3000} className="tabular-nums" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="areas">Areas you deliver to</Label>
            <Input id="areas" name="areas" placeholder="Kololo, Ntinda, Bukoto" />
          </div>
        </div>
      </fieldset>

      <label className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
        <input type="checkbox" name="sampleMenu" defaultChecked className="mt-0.5 size-4 accent-foreground" />
        <span>
          <span className="font-medium">Start with a sample Kampala menu</span>
          <span className="block text-muted-foreground">Rolex, luwombo, pilau and drinks, so you can test the bot now. Edit or delete them later.</span>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Creating…" : "Create my restaurant"}
      </Button>
    </form>
  );
}
