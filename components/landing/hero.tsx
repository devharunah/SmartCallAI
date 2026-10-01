import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { ChatPreview } from "./chat-preview";
import { OrderCard } from "./order-card";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Atmosphere only: the two blooms sit behind the copy and never hold content. */}
      <div aria-hidden className="absolute inset-0 -z-0">
        <div className="orb motion-safe:animate-orb top-[-6rem] left-1/2 size-[22rem] -translate-x-[85%] bg-orb-mint sm:size-[32rem]" />
        <div className="orb motion-safe:animate-orb top-[2rem] left-1/2 size-[20rem] translate-x-[5%] bg-orb-peach [animation-delay:-9s] sm:size-[28rem]" />
        <div className="orb top-[34rem] left-1/2 size-[26rem] -translate-x-1/2 bg-orb-lavender opacity-50 sm:size-[40rem]" />
      </div>

      <div className="relative mx-auto max-w-300 px-4 pt-16 pb-16 text-center sm:px-6 md:pt-24 md:pb-24">
        <p className="mx-auto w-fit rounded-full bg-card/70 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-foreground uppercase ring-1 ring-border backdrop-blur-sm">
          AI ordering on WhatsApp
        </p>

        <h1 className="mx-auto mt-6 max-w-4xl font-heading text-[2.6rem] leading-[1.05] text-balance sm:text-6xl md:text-[4.5rem]">
          Your restaurant takes orders on WhatsApp, even while you cook.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-pretty text-body">
          {BRAND.name} answers every message on your WhatsApp. It sends the menu, takes the order from a text or voice note, and puts it on your
          kitchen board. No app for customers, no commission.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/try">Try the demo</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full bg-card/60 backdrop-blur-sm sm:w-auto">
            <Link href="/signup">Set up your restaurant</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Free to try. The demo runs in your browser, no WhatsApp needed.</p>

        {/* The product, not a picture of it: the chat on the left becomes the ticket on the right. */}
        <div className="mx-auto mt-16 grid max-w-4xl items-start gap-4 text-left md:mt-20 md:grid-cols-[1.25fr_1fr] md:gap-5">
          <ChatPreview />
          <OrderCard className="md:mt-24" />
        </div>
      </div>
    </section>
  );
}
