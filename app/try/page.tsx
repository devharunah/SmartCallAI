import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { ChatSimulator } from "@/components/chat/chat-simulator";

export const metadata: Metadata = {
  title: `Try the demo · ${BRAND.name}`,
  description: "Order from a demo Kampala restaurant the way your customers would on WhatsApp, in Luganda or English.",
};

// PUBLIC demo. Meta's free test number can only reach 5 phones, so this is the
// shareable way to try the bot: same engine, same workflow, in the browser.
export default function TryPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:items-start lg:py-14">
      <div className="lg:pt-10">
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Live demo</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Order from Mama Rose Kitchen, like a customer would on WhatsApp.
        </h1>
        <p className="mt-4 max-w-prose text-pretty text-muted-foreground">
          Ask for the menu, order a rolex and a juice, or send a voice note in Luganda. When you confirm, the order lands on
          the restaurant&apos;s board.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
          <li>Prices always come from the restaurant&apos;s menu, never from the AI.</li>
          <li>Type &quot;omuntu&quot; or &quot;person&quot; to hand the chat to staff.</li>
          <li>This is a demo restaurant, so no food will arrive.</li>
        </ul>
        <p className="mt-8 text-sm">
          Own a restaurant?{" "}
          <Link href="/signup" className="font-medium underline underline-offset-4 hover:text-muted-foreground">
            Set up {BRAND.name} for yours
          </Link>
        </p>
      </div>
      <ChatSimulator restaurantName="Mama Rose Kitchen" />
    </div>
  );
}
