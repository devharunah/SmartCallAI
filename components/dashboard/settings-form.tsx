"use client";

import { useActionState } from "react";
import { updateSettings, type SettingsState } from "@/app/(protected)/dashboard/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Restaurant } from "@/lib/restaurants/types";

const initial: SettingsState = { error: null };

export function SettingsForm({ restaurant, whatsapp }: { restaurant: Restaurant; whatsapp: { configured: boolean; webhookUrl: string } }) {
  const [state, action, pending] = useActionState(updateSettings, initial);
  const d = restaurant.delivery;

  return (
    <form action={action} className="grid max-w-3xl gap-10">
      <section className="grid gap-4">
        <h2 className="font-semibold">Restaurant</h2>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={restaurant.name} required maxLength={80} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
          <div className="space-y-2">
            <Label htmlFor="open">Opens</Label>
            <Input id="open" name="open" type="time" defaultValue={restaurant.hours.open} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="close">Closes</Label>
            <Input id="close" name="close" type="time" defaultValue={restaurant.hours.close} required />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">Kampala time, every day. Outside these hours the assistant says you&apos;re closed and doesn&apos;t take orders.</p>
      </section>

      <section className="grid gap-4">
        <h2 className="font-semibold">Pickup and delivery</h2>
        <div className="flex flex-wrap gap-6">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="pickup" defaultChecked={d.pickup} className="size-4 accent-foreground" /> Pickup
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="delivery" defaultChecked={d.delivery} className="size-4 accent-foreground" /> Delivery
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="fee">Delivery fee (UGX)</Label>
            <Input id="fee" name="fee" type="number" min={0} step={500} defaultValue={d.fee} className="tabular-nums" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="areas">Areas you deliver to</Label>
            <Input id="areas" name="areas" defaultValue={d.areas.join(", ")} placeholder="Kololo, Ntinda, Bukoto" />
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="font-semibold">Assistant</h2>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Language for new customers</legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:max-w-sm">
            {[
              { value: "lug", label: "Luganda" },
              { value: "eng", label: "English" },
            ].map((o) => (
              <label key={o.value} className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-[:checked]:border-foreground">
                <input type="radio" name="defaultLanguage" value={o.value} defaultChecked={restaurant.defaultLanguage === o.value} className="accent-foreground" />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <Label htmlFor="greeting">Anything the assistant should always know</Label>
          <textarea
            id="greeting"
            name="greeting"
            defaultValue={restaurant.greeting ?? ""}
            maxLength={300}
            rows={3}
            placeholder="e.g. We're opposite Capital Shoppers, Ntinda. Free delivery on orders over UGX 50,000."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="flex items-center gap-2 font-semibold">
          WhatsApp
          <Badge variant={whatsapp.configured ? "secondary" : "outline"}>{whatsapp.configured ? "API connected" : "Not connected"}</Badge>
        </h2>
        <div className="space-y-2">
          <Label htmlFor="whatsappPhoneNumberId">Phone number ID</Label>
          <Input
            id="whatsappPhoneNumberId"
            name="whatsappPhoneNumberId"
            defaultValue={restaurant.whatsappPhoneNumberId ?? ""}
            inputMode="numeric"
            placeholder="From Meta: WhatsApp → API Setup"
            className="font-mono sm:max-w-sm"
          />
          <p className="text-xs text-pretty text-muted-foreground">
            Messages to this number come to your restaurant. Webhook URL for your Meta app: <code className="font-mono">{whatsapp.webhookUrl}</code>
          </p>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        <p role="status" className="text-sm" aria-live="polite">
          {state.error ? <span className="text-destructive">{state.error}</span> : state.saved ? <span className="text-muted-foreground">Saved</span> : null}
        </p>
      </div>
    </form>
  );
}
