import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { ChatPreview } from "./chat-preview";

// Adapted from Tailark Mist hero-section-2 (MIT, github.com/tailark/blocks).
export function Hero() {
  return (
    <section className="relative overflow-hidden before:absolute before:inset-1 before:h-[calc(100%-10rem)] before:rounded-2xl before:bg-muted sm:before:inset-2 md:before:rounded-4xl lg:before:h-[calc(100%-14rem)]">
      <div className="pt-16 pb-4 md:pt-28 md:pb-8">
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <Link
            href="/try"
            className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-background py-1 pr-3 pl-1 text-sm transition-colors duration-150 hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">New</span>
            <span className="font-medium">Understands Luganda voice notes</span>
            <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
          </Link>

          <h1 className="mx-auto mt-8 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
            Your restaurant on WhatsApp, taking orders day and night.
          </h1>
          <p className="mx-auto my-6 max-w-xl text-lg text-balance text-muted-foreground">
            {BRAND.name} answers your WhatsApp in Luganda and English. It sends your menu, takes the order from a text or voice note, and puts it
            on your kitchen board. No app for customers, no commission.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/try">Try the demo</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/signup">Set up your restaurant</Link>
            </Button>
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-12 max-w-2xl px-6 md:mt-16">
          <ChatPreview />
        </div>
      </div>
    </section>
  );
}
